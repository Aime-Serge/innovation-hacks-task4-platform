from datetime import datetime, timezone
from enum import Enum
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class TaskStatus(str, Enum):
    todo = "todo"
    in_progress = "in-progress"
    done = "done"


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    project_id: UUID
    status: TaskStatus = TaskStatus.todo


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)


class TaskStatusUpdate(BaseModel):
    status: TaskStatus


class TaskOut(BaseModel):
    id: UUID
    title: str
    description: str | None
    project_id: UUID
    status: TaskStatus
    created_at: datetime
    updated_at: datetime


class TaskInDB(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    title: str
    description: str | None
    project_id: UUID
    status: TaskStatus = TaskStatus.todo
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def to_out(self) -> TaskOut:
        return TaskOut(
            id=self.id,
            title=self.title,
            description=self.description,
            project_id=self.project_id,
            status=self.status,
            created_at=self.created_at,
            updated_at=self.updated_at,
        )
