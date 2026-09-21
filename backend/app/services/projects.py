from dataclasses import dataclass, replace
from datetime import date
from uuid import UUID

from app.core.clock import Clock, IdFactory
from app.core.errors import ErrorDetail, NotFound, ProjectNotEmpty, ValidationFailed
from app.domain.enums import ActivityType, ProjectStatus
from app.domain.models import Progress, Project
from app.domain.unset import UNSET, Unset
from app.repositories.base import Page, ProjectQuery, UnitOfWork
from app.services import transaction
from app.services.activity import ActivityService
from app.services.authz import Actor, require_project_manager
from app.services.transaction import UowFactory


@dataclass(frozen=True)
class ProjectView:
    project: Project
    progress: Progress


@dataclass(frozen=True)
class ProjectChanges:
    name: str | Unset = UNSET
    description: str | Unset = UNSET
    status: ProjectStatus | Unset = UNSET
    due_date: date | Unset | None = UNSET


async def require_project(
    uow: UnitOfWork, project_id: UUID, *, for_update: bool = False
) -> Project:
    project = await uow.projects.get(project_id, for_update=for_update)
    if project is None:
        raise NotFound("The project was not found.")
    return project


async def require_project_or_invalid(uow: UnitOfWork, project_id: UUID) -> Project:
    """For a body field that names a project: unknown means 422 on that field (FR-214)."""
    project = await uow.projects.get(project_id)
    if project is None:
        raise ValidationFailed(
            "One or more fields are invalid.",
            [ErrorDetail("projectId", "The project does not exist.")],
        )
    return project


class ProjectService:
    def __init__(
        self, uow: UowFactory, activity: ActivityService, clock: Clock, ids: IdFactory
    ) -> None:
        self._uow = uow
        self._activity = activity
        self._clock = clock
        self._ids = ids

    async def create(
        self,
        actor: Actor,
        name: str,
        description: str,
        status: ProjectStatus,
        due_date: date | None,
    ) -> ProjectView:
        now = self._clock.now()

        async def work(uow: UnitOfWork) -> ProjectView:
            project = await uow.projects.add(
                Project(self._ids.new_id(), name, description, status, due_date, actor.id, now, now)
            )
            await self._activity.record(uow, actor.id, project.id, ActivityType.CREATED)
            return ProjectView(project, await uow.tasks.progress_for(project.id))

        return await transaction.write(self._uow, work)

    async def get(self, project_id: UUID) -> ProjectView:
        async def work(uow: UnitOfWork) -> ProjectView:
            project = await require_project(uow, project_id)
            return ProjectView(project, await uow.tasks.progress_for(project.id))

        return await transaction.read(self._uow, work)

    async def list(self, query: ProjectQuery) -> Page[ProjectView]:
        async def work(uow: UnitOfWork) -> Page[ProjectView]:
            page = await uow.projects.list(query)
            # One aggregate over the whole page, not one query per project (NFR-304).
            progress = await uow.tasks.progress_for_many([p.id for p in page.items])
            views = [ProjectView(p, progress[p.id]) for p in page.items]
            return Page(views, page.page, page.page_size, page.total)

        return await transaction.read(self._uow, work)

    async def update(self, actor: Actor, project_id: UUID, changes: ProjectChanges) -> ProjectView:
        async def work(uow: UnitOfWork) -> ProjectView:
            project = await require_project(uow, project_id, for_update=True)
            require_project_manager(actor, project)
            updated = replace(
                project,
                name=project.name if isinstance(changes.name, Unset) else changes.name,
                description=project.description
                if isinstance(changes.description, Unset)
                else changes.description,
                status=project.status if isinstance(changes.status, Unset) else changes.status,
                due_date=project.due_date
                if isinstance(changes.due_date, Unset)
                else changes.due_date,
                updated_at=self._clock.now(),
            )
            saved = await uow.projects.update(updated)
            return ProjectView(saved, await uow.tasks.progress_for(saved.id))

        return await transaction.write(self._uow, work)

    async def delete(self, actor: Actor, project_id: UUID) -> None:
        async def work(uow: UnitOfWork) -> None:
            # The lock serialises this against a task being created in the project (FR-314).
            project = await require_project(uow, project_id, for_update=True)
            require_project_manager(actor, project)
            if (await uow.tasks.progress_for(project_id)).total_tasks > 0:
                raise ProjectNotEmpty("The project still has tasks and cannot be deleted.")
            await uow.projects.delete(project_id)  # BR-206

        await transaction.write(self._uow, work)
