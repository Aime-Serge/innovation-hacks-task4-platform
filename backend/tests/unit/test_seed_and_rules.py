"""TC-310 to TC-314: seed profiles and the pure business rules."""

from datetime import UTC, date, datetime

import pytest

from app.domain.enums import Priority, TaskStatus
from app.domain.models import Task
from app.domain.rules import (
    ALLOWED_TRANSITIONS,
    can_transition,
    completed_at_after,
    is_overdue,
    progress,
)
from app.main import create_app
from app.seed import seed
from tests.conftest import PASSWORD, make_settings

NOW = datetime(2026, 9, 20, 12, tzinfo=UTC)


def a_task(status: TaskStatus, due: date | None) -> Task:
    from uuid import uuid4

    return Task(uuid4(), uuid4(), "t", "", status, Priority.LOW, due, None, None, NOW, NOW)


def test_tc312_workflow_table_is_the_only_path() -> None:
    allowed = {(a, b) for a, targets in ALLOWED_TRANSITIONS.items() for b in targets}
    assert allowed == {
        (TaskStatus.TODO, TaskStatus.IN_PROGRESS),
        (TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW),
        (TaskStatus.IN_REVIEW, TaskStatus.IN_PROGRESS),
        (TaskStatus.IN_REVIEW, TaskStatus.DONE),
        (TaskStatus.DONE, TaskStatus.IN_PROGRESS),
    }
    for a in TaskStatus:
        for b in TaskStatus:
            assert can_transition(a, b) == ((a, b) in allowed)


def test_tc312_completed_at_is_set_on_done_and_cleared_on_leaving() -> None:
    assert completed_at_after(TaskStatus.IN_REVIEW, TaskStatus.DONE, None, NOW) == NOW
    assert completed_at_after(TaskStatus.DONE, TaskStatus.IN_PROGRESS, NOW, NOW) is None
    assert completed_at_after(TaskStatus.TODO, TaskStatus.IN_PROGRESS, None, NOW) is None


@pytest.mark.parametrize(
    ("total", "done", "percent"), [(0, 0, 0), (3, 1, 33), (3, 2, 67), (4, 4, 100), (8, 1, 12)]
)
def test_tc313_progress_rounds_to_whole_percent(total: int, done: int, percent: int) -> None:
    assert progress(total, done).percent == percent


def test_tc313_overdue_is_strictly_before_today_and_not_done() -> None:
    today = date(2026, 9, 20)
    assert is_overdue(a_task(TaskStatus.TODO, date(2026, 9, 19)), today)
    assert not is_overdue(a_task(TaskStatus.TODO, today), today)
    assert not is_overdue(a_task(TaskStatus.DONE, date(2026, 1, 1)), today)
    assert not is_overdue(a_task(TaskStatus.TODO, None), today)


async def test_tc314_default_seed_matches_task1_shape() -> None:
    app = create_app(make_settings())
    result = await seed(app.state.container, "default", PASSWORD)
    assert (result.users, result.projects, result.tasks, result.activity) == (4, 8, 60, 40)


async def test_tc314_large_and_empty_profiles() -> None:
    app = create_app(make_settings())
    large = await seed(app.state.container, "large", PASSWORD)
    assert (large.users, large.projects, large.tasks) == (4, 40, 500)
    empty = await seed(create_app(make_settings()).state.container, "empty", PASSWORD)
    assert (empty.users, empty.projects, empty.tasks) == (4, 0, 0)


async def test_tc314_seed_is_deterministic() -> None:
    first = create_app(make_settings())
    second = create_app(make_settings())
    await seed(first.state.container, "default", PASSWORD)
    await seed(second.state.container, "default", PASSWORD)
    from app.repositories.base import TaskQuery

    async with first.state.container.uow() as uow_one:
        one = await uow_one.tasks.list(TaskQuery(sort="title", page_size=100))
    async with second.state.container.uow() as uow_two:
        two = await uow_two.tasks.list(TaskQuery(sort="title", page_size=100))
    assert [t.title for t in one.items] == [t.title for t in two.items]


async def test_tc314_seed_refuses_production() -> None:
    app = create_app(make_settings(app_env="production"))
    with pytest.raises(RuntimeError, match="production"):
        await seed(app.state.container, "default", PASSWORD)
