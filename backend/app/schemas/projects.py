from datetime import date
from typing import ClassVar
from uuid import UUID

from pydantic import Field

from app.domain.enums import ProjectStatus
from app.domain.models import Progress, Project
from app.schemas.base import (
    CLEAN,
    ApiModel,
    IsoDate,
    Name,
    OutModel,
    PatchModel,
    SearchText,
    TimestampedOut,
)
from app.schemas.common import ListQuery, sort_param


class ProgressOut(OutModel):
    total_tasks: int = Field(ge=0)
    done_tasks: int = Field(ge=0)
    percent: int = Field(ge=0, le=100, description="Done over total, whole percent (BR-03).")

    @classmethod
    def of(cls, progress: Progress) -> "ProgressOut":
        return cls(
            total_tasks=progress.total_tasks,
            done_tasks=progress.done_tasks,
            percent=progress.percent,
        )


class ProjectCreate(ApiModel):
    name: Name = Field(examples=["Atlas API Gateway"])
    description: str = Field(default="", max_length=2000, pattern=CLEAN)
    status: ProjectStatus = ProjectStatus.PLANNED
    due_date: IsoDate | None = Field(default=None, examples=["2026-12-01"])


class ProjectUpdate(PatchModel):
    nullable: ClassVar[frozenset[str]] = frozenset({"due_date"})

    name: Name | None = None
    description: str | None = Field(default=None, max_length=2000, pattern=CLEAN)
    status: ProjectStatus | None = None
    due_date: IsoDate | None = None


class ProjectOut(TimestampedOut):
    id: UUID
    name: str
    description: str
    status: ProjectStatus
    due_date: date | None
    owner_id: UUID
    progress: ProgressOut

    @classmethod
    def of(cls, project: Project, progress: Progress) -> "ProjectOut":
        return cls(
            id=project.id,
            name=project.name,
            description=project.description,
            status=project.status,
            due_date=project.due_date,
            owner_id=project.owner_id,
            progress=ProgressOut.of(progress),
            created_at=project.created_at,
            updated_at=project.updated_at,
        )


class ProjectListQuery(ListQuery):
    sort_fields: ClassVar[tuple[str, ...]] = ("dueDate", "name", "createdAt")
    sort: str | None = sort_param(*sort_fields)
    q: SearchText | None = None
    status: list[ProjectStatus] = Field(default_factory=list)
    owner_id: UUID | None = None
