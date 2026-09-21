from collections.abc import Sequence
from typing import Any
from uuid import UUID

from sqlalchemy import ColumnElement, delete, func, insert, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import ProjectStatus
from app.domain.models import Project
from app.domain.queries import Page, ProjectQuery
from app.repositories.sql import common, mappers
from app.repositories.sql.models import ProjectRow

COLUMNS = (
    ProjectRow.id,
    ProjectRow.name,
    ProjectRow.description,
    ProjectRow.status,
    ProjectRow.due_date,
    ProjectRow.owner_id,
    ProjectRow.created_at,
    ProjectRow.updated_at,
)


class SqlProjectRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, project_id: UUID, *, for_update: bool = False) -> Project | None:
        statement = select(*COLUMNS).where(ProjectRow.id == project_id)
        if for_update:
            statement = statement.with_for_update()
        row = (await common.run(self._session, statement, "read")).first()
        return None if row is None else mappers.project_from(row)

    async def list(self, query: ProjectQuery) -> Page[Project]:
        conditions: list[ColumnElement[bool]] = []
        if query.statuses:
            conditions.append(ProjectRow.status.in_([s.value for s in query.statuses]))
        if query.owner_id is not None:
            conditions.append(ProjectRow.owner_id == query.owner_id)
        pattern = common.like_pattern(query.q)
        if pattern is not None:
            conditions.append(
                or_(
                    ProjectRow.name.ilike(pattern, escape="\\"),
                    ProjectRow.description.ilike(pattern, escape="\\"),
                )
            )
        if query.sort == "dueDate":
            first = ProjectRow.due_date.desc() if query.descending else ProjectRow.due_date.asc()
            order: list[Any] = [
                first.nulls_last(),
                ProjectRow.id.asc(),
            ]  # BR-309: undated last, both ways
        else:
            key = (
                common.codepoint_order(func.lower(ProjectRow.name))
                if query.sort == "name"
                else ProjectRow.created_at
            )
            order = [key.desc() if query.descending else key.asc(), ProjectRow.id.asc()]
        return await common.page_of(
            self._session,
            select(*COLUMNS).where(*conditions).order_by(*order),
            select(ProjectRow.id).where(*conditions),
            query.page,
            query.page_size,
            mappers.project_from,
            window=True,
        )

    async def add(self, project: Project) -> Project:
        await common.run(
            self._session, insert(ProjectRow).values(mappers.project_values(project)), "insert"
        )
        return project

    async def add_many(self, projects: Sequence[Project]) -> None:
        await common.run_many(
            self._session, insert(ProjectRow), [mappers.project_values(p) for p in projects]
        )

    async def update(self, project: Project) -> Project:
        values = mappers.project_values(project)
        for immutable in ("id", "owner_id", "created_at"):
            values.pop(immutable)
        await common.run(
            self._session,
            update(ProjectRow).where(ProjectRow.id == project.id).values(values),
            "update",
        )
        return project

    async def delete(self, project_id: UUID) -> bool:
        result = await common.run(
            self._session, delete(ProjectRow).where(ProjectRow.id == project_id), "delete"
        )
        return bool(result.rowcount)

    async def count_by_owner(self, owner_id: UUID) -> int:
        statement = (
            select(func.count()).select_from(ProjectRow).where(ProjectRow.owner_id == owner_id)
        )
        return int((await common.run(self._session, statement, "read")).scalar_one())

    async def count(self, statuses: Sequence[ProjectStatus] = ()) -> int:
        statement = select(func.count()).select_from(ProjectRow)
        if statuses:
            statement = statement.where(ProjectRow.status.in_([s.value for s in statuses]))
        return int((await common.run(self._session, statement, "read")).scalar_one())
