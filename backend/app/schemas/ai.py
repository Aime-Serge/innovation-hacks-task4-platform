"""Request and response bodies of the AI endpoints (section 6)."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field

from app.schemas.base import CLEAN, ApiModel, OutModel

Priority = Literal["low", "medium", "high", "urgent"]


class TaskSuggestionRequest(ApiModel):
    brief: str | None = Field(
        default=None,
        max_length=1000,
        pattern=CLEAN,
        description="What the work is about, in a sentence or two. Optional.",
        examples=["Launch the mobile onboarding flow"],
    )
    count: int = Field(default=5, ge=1, le=10, description="How many tasks to suggest.")


class MetaOut(OutModel):
    model: str | None
    prompt_version: str = Field(examples=["task-generation-v1"])
    request_id: UUID


class QuotaOut(OutModel):
    daily_limit: int
    remaining_today: int
    resets_at: datetime


class AiStatusOut(OutModel):
    enabled: bool
    features: list[str]
    quota: QuotaOut


class SuggestionOut(OutModel):
    title: str
    description: str
    priority: Priority
    due_in_days: int | None = Field(description="Days from today, 0 to 90; the interface adds it.")


class SuggestionsOut(OutModel):
    suggestions: list[SuggestionOut]
    meta: MetaOut


class RankedTaskOut(OutModel):
    task_id: UUID
    rank: int
    suggested_priority: Priority
    reason: str


class PrioritizationOut(OutModel):
    items: list[RankedTaskOut]
    meta: MetaOut


class AiSummaryOut(OutModel):
    summary: str
    risks: list[str]
    next_steps: list[str]
    meta: MetaOut
