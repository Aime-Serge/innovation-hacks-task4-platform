from datetime import datetime, timezone
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    description: str | None = Field(default=None, max_length=2000)
    owner_id: UUID


class ProjectOut(BaseModel):
    id: UUID
    name: str
    description: str | None
    owner_id: UUID
    created_at: datetime


class ProjectInDB(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    name: str
    description: str | None
    owner_id: UUID
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def to_out(self) -> ProjectOut:
        return ProjectOut(
            id=self.id,
            name=self.name,
            description=self.description,
            owner_id=self.owner_id,
            created_at=self.created_at,
        )
