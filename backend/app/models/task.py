from datetime import date, datetime, timezone
from enum import Enum
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class TaskStatus(str, Enum):
    todo = "todo"
    in_progress = "in-progress"
    done = "done"
    blocked = "blocked"


class TaskPriority(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    project_id: UUID
    status: TaskStatus = TaskStatus.todo
    priority: TaskPriority = TaskPriority.medium
    due_date: date | None = None
    assignee_id: UUID | None = None


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    priority: TaskPriority | None = None
    due_date: date | None = None
    assignee_id: UUID | None = None
    clear_due_date: bool = False
    clear_assignee: bool = False


class TaskStatusUpdate(BaseModel):
    status: TaskStatus


class TaskOut(BaseModel):
    id: UUID
    title: str
    description: str | None
    project_id: UUID
    status: TaskStatus
    priority: TaskPriority
    due_date: date | None
    assignee_id: UUID | None
    created_at: datetime
    updated_at: datetime


class TaskInDB(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    title: str
    description: str | None
    project_id: UUID
    status: TaskStatus = TaskStatus.todo
    priority: TaskPriority = TaskPriority.medium
    due_date: date | None = None
    assignee_id: UUID | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def to_out(self) -> TaskOut:
        return TaskOut(
            id=self.id,
            title=self.title,
            description=self.description,
            project_id=self.project_id,
            status=self.status,
            priority=self.priority,
            due_date=self.due_date,
            assignee_id=self.assignee_id,
            created_at=self.created_at,
            updated_at=self.updated_at,
        )
