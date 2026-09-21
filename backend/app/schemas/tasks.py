from datetime import date, datetime
from typing import ClassVar
from uuid import UUID

from pydantic import Field

from app.domain.enums import Priority, TaskStatus
from app.domain.models import Task
from app.schemas.base import CLEAN, ApiModel, IsoDate, PatchModel, SearchText, TimestampedOut, Title
from app.schemas.common import ListQuery, sort_param


class TaskCreate(ApiModel):
    project_id: UUID
    title: Title = Field(examples=["Write the migration plan"])
    description: str = Field(default="", max_length=4000, pattern=CLEAN)
    priority: Priority = Priority.MEDIUM
    due_date: IsoDate | None = Field(default=None, examples=["2026-11-15"])
    assignee_id: UUID | None = None


class TaskUpdate(PatchModel):
    nullable: ClassVar[frozenset[str]] = frozenset({"due_date", "assignee_id"})

    title: Title | None = None
    description: str | None = Field(default=None, max_length=4000, pattern=CLEAN)
    priority: Priority | None = None
    due_date: IsoDate | None = None
    assignee_id: UUID | None = None


class StatusChange(ApiModel):
    status: TaskStatus = Field(examples=["in_progress"])


class TaskOut(TimestampedOut):
    id: UUID
    project_id: UUID
    title: str
    description: str
    status: TaskStatus
    priority: Priority
    due_date: date | None
    assignee_id: UUID | None
    completed_at: datetime | None

    @classmethod
    def of(cls, task: Task) -> "TaskOut":
        return cls(
            id=task.id,
            project_id=task.project_id,
            title=task.title,
            description=task.description,
            status=task.status,
            priority=task.priority,
            due_date=task.due_date,
            assignee_id=task.assignee_id,
            completed_at=task.completed_at,
            created_at=task.created_at,
            updated_at=task.updated_at,
        )


class TaskListQuery(ListQuery):
    sort_fields: ClassVar[tuple[str, ...]] = ("dueDate", "priority", "title", "createdAt")
    sort: str | None = sort_param(*sort_fields)
    default_sort: ClassVar[str] = "createdAt"
    q: SearchText | None = None
    status: list[TaskStatus] = Field(default_factory=list)
    priority: list[Priority] = Field(default_factory=list)
    project_id: list[UUID] = Field(default_factory=list)
    assignee_id: list[UUID] = Field(default_factory=list)
    overdue: bool | None = Field(default=None, description="BR-04: due before today, not done.")
    due_before: IsoDate | None = None
    due_after: IsoDate | None = None
