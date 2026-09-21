"""Domain entities: immutable, so a repository can hand out its data without copying risks."""

from dataclasses import dataclass, field
from datetime import date, datetime
from uuid import UUID

from app.domain.enums import ActivityType, Priority, ProjectStatus, Role, TaskStatus, Theme


@dataclass(frozen=True, slots=True)
class User:
    id: UUID
    name: str
    email: str
    # Not part of equality or repr: only the login lookup loads it (NFR-318, ADR-315).
    password_hash: str = field(compare=False, repr=False)
    role: Role
    avatar_url: str | None
    theme: Theme
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True, slots=True)
class Project:
    id: UUID
    name: str
    description: str
    status: ProjectStatus
    due_date: date | None
    owner_id: UUID
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True, slots=True)
class Task:
    id: UUID
    project_id: UUID
    title: str
    description: str
    status: TaskStatus
    priority: Priority
    due_date: date | None
    assignee_id: UUID | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True, slots=True)
class Activity:
    id: UUID
    actor_id: UUID
    project_id: UUID
    task_id: UUID | None
    type: ActivityType
    at: datetime


@dataclass(frozen=True, slots=True)
class Progress:
    total_tasks: int
    done_tasks: int
    percent: int


@dataclass(frozen=True, slots=True)
class RefreshToken:
    """One rotating refresh token; only its SHA-256 hash is stored (BR-404, FR-406)."""

    id: UUID
    user_id: UUID
    family_id: UUID
    token_hash: str = field(repr=False)
    expires_at: datetime
    used_at: datetime | None
    revoked_at: datetime | None
    created_at: datetime


@dataclass(frozen=True, slots=True)
class AiRequest:
    """One AI call's metadata. No prompt or output text is ever stored (FR-430, ADR-411)."""

    id: UUID
    user_id: UUID | None
    feature: str
    status: str
    provider: str
    model: str | None
    prompt_version: str
    input_tokens: int | None
    output_tokens: int | None
    latency_ms: int | None
    error_code: str | None
    created_at: datetime
