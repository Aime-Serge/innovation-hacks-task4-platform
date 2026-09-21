from dataclasses import dataclass, replace
from datetime import date
from uuid import UUID

from app.core.clock import Clock, IdFactory
from app.core.errors import (
    ErrorDetail,
    InvalidStatusTransition,
    NotFound,
    ProjectClosed,
    ValidationFailed,
)
from app.domain.enums import ActivityType, Priority, ProjectStatus, TaskStatus
from app.domain.models import Task
from app.domain.rules import allowed_next, can_transition, completed_at_after
from app.domain.unset import UNSET, Unset
from app.repositories.base import Page, TaskQuery, UnitOfWork
from app.services import transaction
from app.services.activity import ActivityService
from app.services.authz import Actor, require_project_manager, require_task_editor
from app.services.projects import require_project, require_project_or_invalid
from app.services.transaction import UowFactory


@dataclass(frozen=True)
class NewTask:
    project_id: UUID
    title: str
    description: str
    priority: Priority
    due_date: date | None
    assignee_id: UUID | None


@dataclass(frozen=True)
class TaskChanges:
    title: str | Unset = UNSET
    description: str | Unset = UNSET
    priority: Priority | Unset = UNSET
    due_date: date | Unset | None = UNSET
    assignee_id: UUID | Unset | None = UNSET


async def require_task(uow: UnitOfWork, task_id: UUID, *, for_update: bool = False) -> Task:
    task = await uow.tasks.get(task_id, for_update=for_update)
    if task is None:
        raise NotFound("The task was not found.")
    return task


async def _check_assignee(uow: UnitOfWork, assignee_id: UUID | None) -> None:
    if assignee_id is not None and await uow.users.get(assignee_id) is None:
        raise ValidationFailed(
            "One or more fields are invalid.",
            [ErrorDetail("assigneeId", "The assignee does not exist.")],
        )


class TaskService:
    def __init__(
        self, uow: UowFactory, activity: ActivityService, clock: Clock, ids: IdFactory
    ) -> None:
        self._uow = uow
        self._activity = activity
        self._clock = clock
        self._ids = ids

    async def create(self, actor: Actor, data: NewTask) -> Task:
        async def work(uow: UnitOfWork) -> Task:
            project = await require_project_or_invalid(uow, data.project_id)
            require_project_manager(actor, project)  # BR-203
            if project.status is ProjectStatus.COMPLETED:
                raise ProjectClosed("A completed project accepts no new tasks.")  # BR-205
            await _check_assignee(uow, data.assignee_id)
            now = self._clock.now()
            task = await uow.tasks.add(
                Task(
                    id=self._ids.new_id(),
                    project_id=data.project_id,
                    title=data.title,
                    description=data.description,
                    status=TaskStatus.TODO,
                    priority=data.priority,
                    due_date=data.due_date,
                    assignee_id=data.assignee_id,
                    completed_at=None,
                    created_at=now,
                    updated_at=now,
                )
            )
            await self._activity.record(
                uow, actor.id, data.project_id, ActivityType.CREATED, task.id
            )
            return task

        return await transaction.write(self._uow, work)

    async def get(self, task_id: UUID) -> Task:
        return await transaction.read(self._uow, lambda uow: require_task(uow, task_id))

    async def list(self, query: TaskQuery) -> Page[Task]:
        return await transaction.read(self._uow, lambda uow: uow.tasks.list(query))

    async def list_for_project(self, project_id: UUID, query: TaskQuery) -> Page[Task]:
        async def work(uow: UnitOfWork) -> Page[Task]:
            await require_project(uow, project_id)  # 404 for an unknown project (FR-220)
            return await uow.tasks.list(replace(query, project_ids=[project_id]))

        return await transaction.read(self._uow, work)

    async def update(self, actor: Actor, task_id: UUID, changes: TaskChanges) -> Task:
        async def work(uow: UnitOfWork) -> Task:
            task = await require_task(uow, task_id, for_update=True)
            require_task_editor(actor, task, await require_project(uow, task.project_id))
            if not isinstance(changes.assignee_id, Unset):
                await _check_assignee(uow, changes.assignee_id)
            updated = replace(
                task,
                title=task.title if isinstance(changes.title, Unset) else changes.title,
                description=task.description
                if isinstance(changes.description, Unset)
                else changes.description,
                priority=task.priority if isinstance(changes.priority, Unset) else changes.priority,
                due_date=task.due_date if isinstance(changes.due_date, Unset) else changes.due_date,
                assignee_id=task.assignee_id
                if isinstance(changes.assignee_id, Unset)
                else changes.assignee_id,
                updated_at=self._clock.now(),
            )
            return await uow.tasks.update(updated)

        return await transaction.write(self._uow, work)

    async def change_status(self, actor: Actor, task_id: UUID, requested: TaskStatus) -> Task:
        async def work(uow: UnitOfWork) -> Task:
            # The row lock makes "check the current status, then change it" one step (BR-306).
            task = await require_task(uow, task_id, for_update=True)
            require_task_editor(actor, task, await require_project(uow, task.project_id))
            if requested is task.status:
                return task  # BR-204: a no-op succeeds, changes nothing and logs nothing
            if not can_transition(task.status, requested):
                raise InvalidStatusTransition(
                    f"A task cannot move from {task.status.value} to {requested.value}.",
                    [
                        ErrorDetail("allowedStatuses", status.value)
                        for status in allowed_next(task.status)
                    ],
                )
            now = self._clock.now()
            updated = await uow.tasks.update(
                replace(
                    task,
                    status=requested,
                    completed_at=completed_at_after(task.status, requested, task.completed_at, now),
                    updated_at=now,
                )
            )
            kind = (
                ActivityType.COMPLETED
                if requested is TaskStatus.DONE
                else ActivityType.STATUS_CHANGED
            )
            await self._activity.record(uow, actor.id, task.project_id, kind, task.id)
            return updated

        return await transaction.write(self._uow, work)

    async def delete(self, actor: Actor, task_id: UUID) -> None:
        async def work(uow: UnitOfWork) -> None:
            task = await require_task(uow, task_id, for_update=True)
            require_project_manager(actor, await require_project(uow, task.project_id))  # BR-203
            await uow.tasks.delete(task_id)

        await transaction.write(self._uow, work)
