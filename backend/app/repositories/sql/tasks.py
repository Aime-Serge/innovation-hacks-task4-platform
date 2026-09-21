from collections.abc import Sequence
from datetime import date
from typing import Any
from uuid import UUID

from sqlalchemy import (
    ColumnElement,
    SQLColumnExpression,
    and_,
    delete,
    func,
    insert,
    not_,
    or_,
    select,
    update,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models import Progress, Task
from app.domain.queries import Page, TaskQuery, TaskTotals
from app.domain.rules import progress as make_progress
from app.repositories.sql import common, mappers
from app.repositories.sql.models import TaskRow

COLUMNS = (
    TaskRow.id,
    TaskRow.project_id,
    TaskRow.title,
    TaskRow.description,
    TaskRow.status,
    TaskRow.priority,
    TaskRow.due_date,
    TaskRow.assignee_id,
    TaskRow.completed_at,
    TaskRow.created_at,
    TaskRow.updated_at,
)


def overdue_condition(today: date) -> ColumnElement[bool]:
    """BR-04: due before today and not done; an undated task is never overdue."""
    return and_(TaskRow.due_date.is_not(None), TaskRow.due_date < today, TaskRow.status != "done")


def conditions(query: TaskQuery) -> list[ColumnElement[bool]]:
    """BR-05 and BR-06: AND across filters, OR within one filter."""
    found: list[ColumnElement[bool]] = []
    pattern = common.like_pattern(query.q)
    if pattern is not None:
        found.append(
            or_(
                TaskRow.title.ilike(pattern, escape="\\"),
                TaskRow.description.ilike(pattern, escape="\\"),
            )
        )
    if query.statuses:
        found.append(TaskRow.status.in_([s.value for s in query.statuses]))
    if query.priorities:
        found.append(TaskRow.priority.in_([p.value for p in query.priorities]))
    if query.project_ids:
        found.append(TaskRow.project_id.in_(query.project_ids))
    if query.assignee_ids:
        found.append(TaskRow.assignee_id.in_(query.assignee_ids))
    if query.due_before is not None:
        found.append(TaskRow.due_date <= query.due_before)
    if query.due_after is not None:
        found.append(TaskRow.due_date >= query.due_after)
    if query.overdue is not None and query.today is not None:
        overdue = overdue_condition(query.today)
        found.append(overdue if query.overdue else not_(overdue))
    return found


def ordering(query: TaskQuery) -> list[ColumnElement[Any]]:
    if query.sort == "dueDate":
        first = TaskRow.due_date.desc() if query.descending else TaskRow.due_date.asc()
        return [first.nulls_last(), TaskRow.id.asc()]  # BR-309: undated last, both ways
    keys: dict[str, SQLColumnExpression[Any]] = {
        "priority": TaskRow.priority_rank,  # BR-309: by importance, not alphabet
        "title": common.codepoint_order(func.lower(TaskRow.title)),
        "createdAt": TaskRow.created_at,
    }
    key = keys[query.sort]
    return [key.desc() if query.descending else key.asc(), TaskRow.id.asc()]


class SqlTaskRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, task_id: UUID, *, for_update: bool = False) -> Task | None:
        statement = select(*COLUMNS).where(TaskRow.id == task_id)
        if for_update:
            statement = statement.with_for_update()
        row = (await common.run(self._session, statement, "read")).first()
        return None if row is None else mappers.task_from(row)

    async def list(self, query: TaskQuery) -> Page[Task]:
        where = conditions(query)
        return await common.page_of(
            self._session,
            select(*COLUMNS).where(*where).order_by(*ordering(query)),
            select(TaskRow.id).where(*where),
            query.page,
            query.page_size,
            mappers.task_from,
            with_total=query.with_total,
        )

    async def add(self, task: Task) -> Task:
        await common.run(self._session, insert(TaskRow).values(mappers.task_values(task)), "insert")
        return task

    async def add_many(self, tasks: Sequence[Task]) -> None:
        await common.run_many(
            self._session, insert(TaskRow), [mappers.task_values(task) for task in tasks]
        )

    async def update(self, task: Task) -> Task:
        values = mappers.task_values(task)
        for immutable in ("id", "created_at"):
            values.pop(immutable)
        await common.run(
            self._session, update(TaskRow).where(TaskRow.id == task.id).values(values), "update"
        )
        return task

    async def delete(self, task_id: UUID) -> bool:
        result = await common.run(
            self._session, delete(TaskRow).where(TaskRow.id == task_id), "delete"
        )
        return bool(result.rowcount)

    async def progress_for(self, project_id: UUID) -> Progress:
        return (await self.progress_for_many([project_id]))[project_id]

    async def progress_for_many(self, project_ids: Sequence[UUID]) -> dict[UUID, Progress]:
        """Done over total per project, from one aggregate over all the ids (BR-03, BR-304)."""
        found: dict[UUID, Progress] = {pid: make_progress(0, 0) for pid in project_ids}
        if not project_ids:
            return found
        statement = (
            select(
                TaskRow.project_id,
                func.count().label("total"),
                func.count().filter(TaskRow.status == "done").label("done"),
            )
            .where(TaskRow.project_id.in_(list(project_ids)))
            .group_by(TaskRow.project_id)
        )
        for row in (await common.run(self._session, statement, "read")).all():
            found[row.project_id] = make_progress(row.total, row.done)
        return found

    async def totals(self, today: date) -> TaskTotals:
        statement = select(
            func.count().label("total"),
            func.count().filter(TaskRow.status == "done").label("done"),
            func.count().filter(overdue_condition(today)).label("overdue"),
        ).select_from(TaskRow)
        row = (await common.run(self._session, statement, "read")).one()
        return TaskTotals(row.total, row.done, row.total - row.done, row.overdue)

    async def unassign_user(self, user_id: UUID) -> int:
        result = await common.run(
            self._session,
            update(TaskRow).where(TaskRow.assignee_id == user_id).values(assignee_id=None),
            "update",
        )
        return int(result.rowcount)
