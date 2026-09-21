"""TC-340 to TC-343: SQL answers every query exactly as the in-memory backend does (FR-311).

The same seeded data goes into both backends, with sequential ids so the two are identical, and the
same random queries run against each. Any difference in order, page or total fails.
"""

import random
from collections.abc import AsyncIterator
from dataclasses import dataclass, replace
from datetime import date, timedelta
from uuid import UUID

import pytest
from pydantic import SecretStr

from app.container import Container, build_container
from app.domain.enums import Priority, ProjectStatus, Role, TaskStatus
from app.domain.queries import ProjectQuery, TaskQuery, UserQuery
from app.seed import seed
from tests import sql_support
from tests.conftest import NOW, PASSWORD, FakeClock, make_settings
from tests.sql_support import Postgres


class SequentialIds:
    """Ids that count up, so two backends seeded alike hold identical ids."""

    def __init__(self) -> None:
        self._next = 0

    def new_id(self) -> UUID:
        self._next += 1
        return UUID(int=self._next)


@dataclass
class Pair:
    memory: Container
    sql: Container


@pytest.fixture
async def pair(postgres: Postgres, worker_db: str) -> AsyncIterator[Pair]:
    await sql_support.empty_tables(postgres, worker_db)
    clock = FakeClock()
    memory = build_container(make_settings(), clock, SequentialIds())
    sql = build_container(
        make_settings(
            storage_backend="sql", database_url=SecretStr(postgres.url("app", worker_db))
        ),
        clock,
        SequentialIds(),
    )
    await seed(memory, "large", PASSWORD)
    await seed(sql, "large", PASSWORD)
    try:
        yield Pair(memory, sql)
    finally:
        await sql.close()


WORDS = ["retry", "ember", "cairn", "queue", "(", "%", "_", "audit log", "  Test  ", "zzz", "1", ""]


def random_task_query(rng: random.Random, today: date, project_ids: list[UUID]) -> TaskQuery:
    """Each filter is used only some of the time, so most queries still find rows."""

    def sometimes(chance: float) -> bool:
        return rng.random() < chance

    return TaskQuery(
        q=(rng.choice(WORDS) or None) if sometimes(0.25) else None,
        statuses=rng.sample(list(TaskStatus), rng.randint(1, 3)) if sometimes(0.4) else [],
        priorities=rng.sample(list(Priority), rng.randint(1, 2)) if sometimes(0.3) else [],
        project_ids=rng.sample(project_ids, rng.randint(1, 3)) if sometimes(0.3) else [],
        overdue=rng.choice([True, False]) if sometimes(0.3) else None,
        today=today,
        due_before=today + timedelta(days=rng.randint(0, 15)) if sometimes(0.2) else None,
        due_after=today + timedelta(days=rng.randint(-8, 5)) if sometimes(0.2) else None,
        sort=rng.choice(["dueDate", "priority", "title", "createdAt"]),
        descending=sometimes(0.5),
        page=rng.choice([1, 1, 1, 2, 3]),
        page_size=rng.choice([1, 7, 20, 50, 100]),
    )


async def ids_of(container: Container, query: TaskQuery) -> tuple[list[UUID], int]:
    async with container.uow() as uow:
        page = await uow.tasks.list(query)
    return [task.id for task in page.items], page.total


@pytest.mark.sql
@pytest.mark.slow
async def test_tc340_random_task_queries_match_the_memory_backend(pair: Pair) -> None:
    rng = random.Random(7)
    today = NOW.date()
    async with pair.memory.uow() as uow:
        project_ids = [p.id for p in (await uow.projects.list(ProjectQuery(page_size=100))).items]
    non_empty = 0
    for _ in range(200):
        query = random_task_query(rng, today, project_ids)
        expected = await ids_of(pair.memory, query)
        assert await ids_of(pair.sql, query) == expected, query
        non_empty += bool(expected[0])
    assert non_empty > 100, "the random queries should mostly find something, or they prove little"


@pytest.mark.sql
@pytest.mark.slow
async def test_tc340_random_project_and_user_queries_match(pair: Pair) -> None:
    rng = random.Random(11)
    for _ in range(80):
        project_query = ProjectQuery(
            q=rng.choice(WORDS) or None,
            statuses=rng.sample(list(ProjectStatus), rng.randint(0, 2)),
            sort=rng.choice(["dueDate", "name", "createdAt"]),
            descending=rng.random() < 0.5,
            page=rng.randint(1, 3),
            page_size=rng.choice([1, 5, 20]),
        )
        user_query = UserQuery(
            q=rng.choice(["a", "mens", "@example", "zzz", "%"]),
            role=rng.choice([None, Role.LEAD, Role.DEVELOPER]),
            sort=rng.choice(["name", "email", "createdAt"]),
            descending=rng.random() < 0.5,
            page_size=rng.choice([1, 2, 10]),
        )
        async with pair.memory.uow() as m, pair.sql.uow() as s:
            mp, sp = await m.projects.list(project_query), await s.projects.list(project_query)
            mu, su = await m.users.list(user_query), await s.users.list(user_query)
        assert ([p.id for p in sp.items], sp.total) == ([p.id for p in mp.items], mp.total)
        assert ([u.id for u in su.items], su.total) == ([u.id for u in mu.items], mu.total)


@pytest.mark.sql
async def test_tc340_progress_and_totals_match(pair: Pair) -> None:
    today = NOW.date()
    async with pair.memory.uow() as m, pair.sql.uow() as s:
        projects = (await m.projects.list(ProjectQuery(page_size=100))).items
        ids = [p.id for p in projects]
        assert await s.tasks.progress_for_many(ids) == await m.tasks.progress_for_many(ids)
        assert await s.tasks.totals(today) == await m.tasks.totals(today)
        assert await s.projects.count() == await m.projects.count()


@pytest.mark.sql
async def test_tc341_search_wildcards_match_literally(pair: Pair) -> None:
    async with pair.sql.uow() as uow:
        project = (await uow.projects.list(ProjectQuery(page_size=1))).items[0]
        owner = project.owner_id
        titles = ["100% done", "a_b", "back\\slash", "axb", "plain"]
        for index, title in enumerate(titles):
            task = (await uow.tasks.list(TaskQuery(page_size=1))).items[0]
            await uow.tasks.add(
                replace(
                    task,
                    id=UUID(int=10_000 + index),
                    title=title,
                    description="",
                    assignee_id=owner,
                )
            )
        await uow.commit()

    async def found(term: str) -> set[str]:
        async with pair.sql.uow() as uow:
            page = await uow.tasks.list(TaskQuery(q=term, page_size=100))
        return {t.title for t in page.items if t.id.int >= 10_000}

    assert await found("%") == {"100% done"}
    assert await found("_") == {"a_b"}
    assert await found("\\") == {"back\\slash"}
    assert await found("a_b") == {"a_b"}  # `_` is not "any character": "axb" must not match
    assert await found("PLAIN") == {"plain"}  # case-insensitive (BR-05)


@pytest.mark.sql
async def test_tc342_priority_sorts_by_importance_and_undated_last_both_ways(pair: Pair) -> None:
    async with pair.sql.uow() as uow:
        urgent_first = await uow.tasks.list(
            TaskQuery(sort="priority", descending=True, page_size=3)
        )
        low_first = await uow.tasks.list(TaskQuery(sort="priority", page_size=3))
        assert {t.priority for t in urgent_first.items} == {Priority.URGENT}
        assert {t.priority for t in low_first.items} == {Priority.LOW}
        for descending in (False, True):
            page = await uow.tasks.list(
                TaskQuery(sort="dueDate", descending=descending, page_size=100)
            )
            seen_undated = False
            for task in page.items:
                if task.due_date is None:
                    seen_undated = True
                else:
                    assert not seen_undated, "a dated task came after an undated one"


@pytest.mark.sql
async def test_tc343_overdue_and_upcoming_follow_the_injected_date(pair: Pair) -> None:
    clock = pair.sql.clock
    assert isinstance(clock, FakeClock)
    async with pair.sql.uow() as uow:
        before = (await uow.tasks.totals(clock.today())).overdue
    clock.advance(days=30)
    async with pair.sql.uow() as uow:
        after = (await uow.tasks.totals(clock.today())).overdue
    assert after >= before  # a month later, nothing that was overdue can have stopped being so
    summary = await pair.sql.dashboard.summary()
    assert summary.overdue_tasks == after
