from collections.abc import Sequence
from dataclasses import replace
from uuid import UUID

from app.domain.enums import ProjectStatus
from app.domain.models import Project
from app.repositories.base import Page, ProjectQuery
from app.repositories.memory.common import (
    Store,
    matches_text,
    order,
    order_optional_date,
    slice_page,
)


class MemoryProjectRepository:
    def __init__(self) -> None:
        self._items: dict[UUID, Project] = {}
        self._store = Store()

    async def get(self, project_id: UUID, *, for_update: bool = False) -> Project | None:
        return self._items.get(project_id)

    async def list(self, query: ProjectQuery) -> Page[Project]:
        projects = [
            project
            for project in self._items.values()
            if (not query.statuses or project.status in query.statuses)
            and (query.owner_id is None or project.owner_id == query.owner_id)
            and matches_text([project.name, project.description], query.q)
        ]
        if query.sort == "dueDate":
            ordered = order_optional_date(
                projects,
                lambda project: project.due_date,
                lambda project: project.id,
                query.descending,
            )
        else:
            key = (
                (lambda project: project.name.lower())
                if query.sort == "name"
                else (lambda project: project.created_at)
            )
            ordered = order(projects, key, lambda project: project.id, query.descending)
        return Page(
            slice_page(ordered, query.page, query.page_size),
            query.page,
            query.page_size,
            len(projects),
        )

    async def add(self, project: Project) -> Project:
        async with self._store.lock:
            self._items[project.id] = replace(project)
        return project

    async def add_many(self, projects: Sequence[Project]) -> None:
        async with self._store.lock:
            for project in projects:
                self._items[project.id] = replace(project)

    async def update(self, project: Project) -> Project:
        async with self._store.lock:
            self._items[project.id] = replace(project)
        return project

    async def delete(self, project_id: UUID) -> bool:
        async with self._store.lock:
            return self._items.pop(project_id, None) is not None

    async def count_by_owner(self, owner_id: UUID) -> int:
        return sum(1 for project in self._items.values() if project.owner_id == owner_id)

    async def count(self, statuses: Sequence[ProjectStatus] = ()) -> int:
        return sum(1 for p in self._items.values() if not statuses or p.status in statuses)
