"""TC-393: one contract suite, run against every repository implementation (NFR-224, NFR-322).

The memory and the SQL implementation must give identical results. The only change to the Task 2
version is set-up: a row that names an owner, a project or an assignee now first stores that row,
because PostgreSQL enforces the foreign keys. No assertion was changed.
"""

from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, date, datetime
from types import SimpleNamespace
from typing import Any, cast
from uuid import UUID, uuid4

import pytest
from pydantic import SecretStr

from app.domain.enums import ActivityType, Priority, ProjectStatus, Role, TaskStatus, Theme
from app.domain.models import Activity, Project, Task, User
from app.repositories.base import (
    ActivityQuery,
    ActivityRepository,
    ProjectQuery,
    ProjectRepository,
    TaskQuery,
    TaskRepository,
    UserQuery,
    UserRepository,
)
from app.repositories.memory import (
    MemoryActivityRepository,
    MemoryProjectRepository,
    MemoryTaskRepository,
    MemoryUserRepository,
)
from app.repositories.sql import Database
from tests import sql_support
from tests.conftest import make_settings
from tests.sql_support import Postgres

T0 = datetime(2026, 9, 20, 12, 0, tzinfo=UTC)


@dataclass
class Repos:
    users: UserRepository
    projects: ProjectRepository
    tasks: TaskRepository
    activity: ActivityRepository


def memory() -> Repos:
    return Repos(
        MemoryUserRepository(),
        MemoryProjectRepository(),
        MemoryTaskRepository(),
        MemoryActivityRepository(),
    )


class Autocommit:
    """Wraps a SQL repository so each call is its own committed transaction."""

    def __init__(self, database: Database, name: str) -> None:
        self._database = database
        self._name = name

    def __getattr__(self, method: str) -> Callable[..., Awaitable[Any]]:
        async def call(*args: Any, **kwargs: Any) -> Any:
            async with self._database.uow() as uow:
                result = await getattr(getattr(uow, self._name), method)(*args, **kwargs)
                await uow.commit()
                return result

        return call


@pytest.fixture(params=["memory", pytest.param("sql", marks=pytest.mark.sql)])
async def repos(request: pytest.FixtureRequest) -> AsyncIterator[Repos]:
    if request.param == "memory":
        yield memory()
        return
    server: Postgres = request.getfixturevalue("postgres")
    name: str = request.getfixturevalue("worker_db")
    await sql_support.empty_tables(server, name)
    database = Database(
        make_settings(storage_backend="sql", database_url=SecretStr(server.url("app", name)))
    )
    try:
        yield cast(
            Repos,
            SimpleNamespace(
                users=Autocommit(database, "users"),
                projects=Autocommit(database, "projects"),
                tasks=Autocommit(database, "tasks"),
                activity=Autocommit(database, "activity"),
            ),
        )
    finally:
        await database.dispose()


async def a_user(repos: Repos) -> UUID:
    """A stored user, so a project it owns or a task it holds satisfies the foreign key."""
    stored = await repos.users.add(user("Owner", f"{uuid4().hex}@example.com"))
    return stored.id


async def a_project(repos: Repos) -> UUID:
    stored = await repos.projects.add(project(await a_user(repos)))
    return stored.id


def user(name: str, email: str, role: Role = Role.DEVELOPER) -> User:
    return User(uuid4(), name, email, "hash", role, None, Theme.SYSTEM, T0, T0)


def project(owner: UUID, name: str = "P", due: date | None = None) -> Project:
    return Project(uuid4(), name, "", ProjectStatus.ACTIVE, due, owner, T0, T0)


def task(
    project_id: UUID,
    title: str = "T",
    status: TaskStatus = TaskStatus.TODO,
    priority: Priority = Priority.MEDIUM,
    due: date | None = None,
    assignee: UUID | None = None,
) -> Task:
    # A done task carries its completion time: the database enforces BR-303.
    done_at = T0 if status is TaskStatus.DONE else None
    return Task(uuid4(), project_id, title, "", status, priority, due, assignee, done_at, T0, T0)


async def test_tc330_user_round_trip_and_case_insensitive_email(repos: Repos) -> None:
    ada = await repos.users.add(user("Ada", "ada@example.com"))
    assert await repos.users.get(ada.id) == ada
    assert await repos.users.get_by_email("ADA@example.com") == ada
    assert await repos.users.get(uuid4()) is None
    assert await repos.users.delete(ada.id) is True
    assert await repos.users.delete(ada.id) is False


async def test_tc331_user_list_search_sort_and_page(repos: Repos) -> None:
    for name in ("Cy", "Ab", "Bo"):
        await repos.users.add(user(name, f"{name.lower()}@example.com"))
    page = await repos.users.list(UserQuery(sort="name", page=1, page_size=2))
    assert [u.name for u in page.items] == ["Ab", "Bo"]
    assert page.total == 3
    reverse = await repos.users.list(UserQuery(sort="name", descending=True, page_size=1))
    assert [u.name for u in reverse.items] == ["Cy"]
    found = await repos.users.list(UserQuery(q="bo"))
    assert [u.name for u in found.items] == ["Bo"]
    beyond = await repos.users.list(UserQuery(page=9))
    assert beyond.items == []
    assert beyond.total == 3


async def test_tc332_lead_count_follows_role_changes(repos: Repos) -> None:
    lead = await repos.users.add(user("L", "l@example.com", Role.LEAD))
    assert await repos.users.count_leads() == 1
    await repos.users.update(
        User(lead.id, lead.name, lead.email, "h", Role.DEVELOPER, None, Theme.SYSTEM, T0, T0)
    )
    assert await repos.users.count_leads() == 0


async def test_tc333_projects_filter_by_owner_and_status_and_undated_sort_last(
    repos: Repos,
) -> None:
    owner, other = await a_user(repos), await a_user(repos)
    await repos.projects.add(project(owner, "Late", date(2026, 12, 1)))
    await repos.projects.add(project(owner, "Soon", date(2026, 10, 1)))
    await repos.projects.add(project(other, "Undated"))
    ordered = await repos.projects.list(ProjectQuery(sort="dueDate"))
    assert [p.name for p in ordered.items] == ["Soon", "Late", "Undated"]
    descending = await repos.projects.list(ProjectQuery(sort="dueDate", descending=True))
    assert descending.items[-1].name == "Undated"
    mine = await repos.projects.list(ProjectQuery(owner_id=owner))
    assert mine.total == 2
    assert await repos.projects.count_by_owner(owner) == 2
    closed = await repos.projects.list(ProjectQuery(statuses=[ProjectStatus.COMPLETED]))
    assert closed.total == 0


async def test_tc334_task_filters_combine_with_and(repos: Repos) -> None:
    person, pid = await a_user(repos), await a_project(repos)
    await repos.tasks.add(task(pid, "a", priority=Priority.HIGH, due=date(2026, 9, 1)))
    await repos.tasks.add(task(pid, "b", TaskStatus.DONE, Priority.HIGH, date(2026, 9, 1)))
    await repos.tasks.add(task(pid, "c", assignee=person, due=date(2026, 10, 1)))
    today = date(2026, 9, 20)
    overdue = await repos.tasks.list(TaskQuery(overdue=True, today=today))
    assert [t.title for t in overdue.items] == ["a"]  # a done task is never overdue (BR-04)
    not_overdue = await repos.tasks.list(TaskQuery(overdue=False, today=today))
    assert {t.title for t in not_overdue.items} == {"b", "c"}
    both = await repos.tasks.list(TaskQuery(priorities=[Priority.HIGH], statuses=[TaskStatus.TODO]))
    assert [t.title for t in both.items] == ["a"]
    assigned = await repos.tasks.list(TaskQuery(assignee_ids=[person]))
    assert [t.title for t in assigned.items] == ["c"]
    ranged = await repos.tasks.list(TaskQuery(due_after=date(2026, 9, 15)))
    assert [t.title for t in ranged.items] == ["c"]
    window = await repos.tasks.list(TaskQuery(due_before=date(2026, 9, 15)))
    assert {t.title for t in window.items} == {"a", "b"}


async def test_tc335_task_priority_sorts_by_rank_not_alphabet(repos: Repos) -> None:
    pid = await a_project(repos)
    for title, priority in (("l", Priority.LOW), ("u", Priority.URGENT), ("m", Priority.MEDIUM)):
        await repos.tasks.add(task(pid, title, priority=priority))
    result = await repos.tasks.list(TaskQuery(sort="priority", descending=True))
    assert [t.title for t in result.items] == ["u", "m", "l"]


async def test_tc336_progress_and_unassign(repos: Repos) -> None:
    person, pid = await a_user(repos), await a_project(repos)
    await repos.tasks.add(task(pid, "a", TaskStatus.DONE, assignee=person))
    await repos.tasks.add(task(pid, "b", assignee=person))
    await repos.tasks.add(task(pid, "c"))
    progress = await repos.tasks.progress_for(pid)
    assert (progress.total_tasks, progress.done_tasks, progress.percent) == (3, 1, 33)
    empty = await repos.tasks.progress_for(uuid4())
    assert (empty.total_tasks, empty.percent) == (0, 0)
    assert await repos.tasks.unassign_user(person) == 2
    assert (await repos.tasks.list(TaskQuery(assignee_ids=[person]))).total == 0


async def test_tc337_paging_is_stable_when_sort_keys_tie(repos: Repos) -> None:
    pid = await a_project(repos)
    for _ in range(7):
        await repos.tasks.add(task(pid, "same", priority=Priority.LOW))
    seen: list[UUID] = []
    for page in (1, 2, 3):
        result = await repos.tasks.list(TaskQuery(sort="title", page=page, page_size=3))
        seen += [t.id for t in result.items]
    assert len(seen) == len(set(seen)) == 7


async def test_tc338_activity_is_newest_first(repos: Repos) -> None:
    actor, pid = await a_user(repos), await a_project(repos)
    for minute in (1, 3, 2):
        at = datetime(2026, 9, 20, 12, minute, tzinfo=UTC)
        await repos.activity.add(Activity(uuid4(), actor, pid, None, ActivityType.CREATED, at))
    page = await repos.activity.list(ActivityQuery(page_size=2))
    assert [a.at.minute for a in page.items] == [3, 2]
    assert page.total == 3
