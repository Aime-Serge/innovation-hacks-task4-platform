from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import Query
from pydantic import Field

from app.domain.enums import ActivityType
from app.domain.models import Activity
from app.schemas.base import CLEAN, ApiModel, OutModel
from app.schemas.common import PageOut
from app.schemas.tasks import TaskOut


class LoginRequest(ApiModel):
    email: str = Field(min_length=1, max_length=254, pattern=CLEAN, examples=["ada@example.com"])
    password: str = Field(
        min_length=1, max_length=128, pattern=CLEAN, json_schema_extra={"format": "password"}
    )
    model_config = ApiModel.model_config | {"str_strip_whitespace": False}


class TokenOut(OutModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"  # noqa: S105 - the OAuth token type, not a secret
    expires_in: int = Field(description="Seconds until the token expires.", examples=[900])


class ActivityOut(OutModel):
    id: UUID
    actor_id: UUID
    project_id: UUID
    task_id: UUID | None
    type: ActivityType
    at: datetime

    @classmethod
    def of(cls, activity: Activity) -> "ActivityOut":
        return cls(
            id=activity.id,
            actor_id=activity.actor_id,
            project_id=activity.project_id,
            task_id=activity.task_id,
            type=activity.type,
            at=activity.at,
        )


class ActivityQueryParams(ApiModel):
    """`limit` is the page size of page 1 (FR-221, ADR-217)."""

    limit: int = Field(default=10, ge=1, le=50)


ActivityParams = Annotated[ActivityQueryParams, Query()]


class SummaryOut(OutModel):
    active_projects: int = Field(ge=0)
    open_tasks: int = Field(ge=0)
    overdue_tasks: int = Field(ge=0)
    completion_rate: int = Field(ge=0, le=100)
    upcoming_deadlines: list[TaskOut]


ActivityPage = PageOut[ActivityOut]
