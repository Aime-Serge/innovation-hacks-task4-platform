from collections.abc import Sequence
from dataclasses import replace
from datetime import date
from uuid import UUID

from app.domain.enums import TaskStatus
from app.domain.models import Progress, Task
from app.domain.queries import TaskTotals
from app.domain.rules import PRIORITY_RANK, is_overdue, progress
from app.repositories.base import Page, TaskQuery
from app.repositories.memory.common import (
    Store,
    matches_text,
    order,
    order_optional_date,
    slice_page,
)


class MemoryTaskRepository:
    def __init__(self) -> None:
        self._items: dict[UUID, Task] = {}
        self._store = Store()

    async def get(self, task_id: UUID, *, for_update: bool = False) -> Task | None:
        return self._items.get(task_id)

    async def list(self, query: TaskQuery) -> Page[Task]:
        tasks = [task for task in self._items.values() if _matches(task, query)]
        if query.sort == "dueDate":
            ordered = order_optional_date(
                tasks, lambda task: task.due_date, lambda task: task.id, query.descending
            )
        else:
            keys = {
                "priority": lambda task: PRIORITY_RANK[task.priority],
                "title": lambda task: task.title.lower(),
                "createdAt": lambda task: task.created_at,
            }
            ordered = order(tasks, keys[query.sort], lambda task: task.id, query.descending)
        return Page(
            slice_page(ordered, query.page, query.page_size),
            query.page,
            query.page_size,
            len(tasks),
        )

    async def add(self, task: Task) -> Task:
        async with self._store.lock:
            self._items[task.id] = replace(task)
        return task

    async def add_many(self, tasks: Sequence[Task]) -> None:
        async with self._store.lock:
            for task in tasks:
                self._items[task.id] = replace(task)

    async def update(self, task: Task) -> Task:
        async with self._store.lock:
            self._items[task.id] = replace(task)
        return task

    async def delete(self, task_id: UUID) -> bool:
        async with self._store.lock:
            return self._items.pop(task_id, None) is not None

    async def progress_for(self, project_id: UUID) -> Progress:
        own = [task for task in self._items.values() if task.project_id == project_id]
        done = sum(1 for task in own if task.status is TaskStatus.DONE)
        return progress(len(own), done)

    async def progress_for_many(self, project_ids: Sequence[UUID]) -> dict[UUID, Progress]:
        """One pass over the tasks for every project asked about, not one pass per project."""
        wanted = set(project_ids)
        totals: dict[UUID, int] = dict.fromkeys(wanted, 0)
        dones: dict[UUID, int] = dict.fromkeys(wanted, 0)
        for task in self._items.values():
            if task.project_id in wanted:
                totals[task.project_id] += 1
                dones[task.project_id] += task.status is TaskStatus.DONE
        return {pid: progress(totals[pid], dones[pid]) for pid in project_ids}

    async def totals(self, today: date) -> TaskTotals:
        tasks = list(self._items.values())
        done = sum(1 for task in tasks if task.status is TaskStatus.DONE)
        overdue = sum(1 for task in tasks if is_overdue(task, today))
        return TaskTotals(len(tasks), done, len(tasks) - done, overdue)

    async def unassign_user(self, user_id: UUID) -> int:
        async with self._store.lock:
            affected = [task for task in self._items.values() if task.assignee_id == user_id]
            for task in affected:
                self._items[task.id] = replace(task, assignee_id=None)
            return len(affected)


def _matches(task: Task, query: TaskQuery) -> bool:
    """BR-05 and BR-06: AND across filters, OR within one filter."""
    if not matches_text([task.title, task.description], query.q):
        return False
    checks = (
        not query.statuses or task.status in query.statuses,
        not query.priorities or task.priority in query.priorities,
        not query.project_ids or task.project_id in query.project_ids,
        not query.assignee_ids or task.assignee_id in query.assignee_ids,
        query.due_before is None
        or (task.due_date is not None and task.due_date <= query.due_before),
        query.due_after is None or (task.due_date is not None and task.due_date >= query.due_after),
        _overdue_matches(task, query),
    )
    return all(checks)


def _overdue_matches(task: Task, query: TaskQuery) -> bool:
    if query.overdue is None or query.today is None:
        return True
    return is_overdue(task, query.today) is query.overdue
