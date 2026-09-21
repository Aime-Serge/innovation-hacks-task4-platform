"""Domain entities: immutable, so a repository can hand out its data without copying risks."""

from dataclasses import dataclass, field
from datetime import date, datetime
from uuid import UUID

from app.domain.enums import (
    ActivityType,
    Discipline,
    EmploymentStatus,
    Priority,
    ProjectStatus,
    Role,
    Seniority,
    TaskStatus,
    Theme,
)


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
    given_name: str | None = None  # null for people who registered before the minimal profile
    family_name: str | None = None


@dataclass(frozen=True, slots=True)
class Profile:
    """One person's professional profile (MF-06). `skills` keep their order, at most 10."""

    user_id: UUID
    discipline: Discipline
    seniority: Seniority
    employment_status: EmploymentStatus
    company_name: str | None
    job_title: str | None
    country_code: str
    city: str | None
    time_zone: str
    headline: str | None
    about: str
    github_url: str | None
    linkedin_url: str | None
    website_url: str | None
    show_professional_details: bool
    terms_version: str
    terms_accepted_at: datetime
    age_confirmed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    skills: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class Member:
    """A user as another member may see them: the profile is None when it is hidden or missing."""

    user: User
    profile: Profile | None


@dataclass(frozen=True, slots=True)
class ProfileStats:
    """Own-page figures from data that already exists (MB-08)."""

    projects_owned: int
    tasks_done: int
    tasks_open: int


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
