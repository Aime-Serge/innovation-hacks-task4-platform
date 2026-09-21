"""Storage-agnostic query and page value objects.

They live in the domain so a router can build a query and a service can pass it on
without either importing the repositories layer (section 7, import-linter).
"""

from dataclasses import dataclass, field
from datetime import date
from uuid import UUID

from app.domain.enums import Priority, ProjectStatus, Role, TaskStatus


@dataclass(frozen=True)
class Page[T]:
    items: list[T]
    page: int
    page_size: int
    total: int


@dataclass(frozen=True)
class UserQuery:
    q: str | None = None
    role: Role | None = None
    sort: str = "createdAt"
    descending: bool = False
    page: int = 1
    page_size: int = 20


@dataclass(frozen=True)
class ProjectQuery:
    q: str | None = None
    statuses: list[ProjectStatus] = field(default_factory=list)
    owner_id: UUID | None = None
    sort: str = "createdAt"
    descending: bool = False
    page: int = 1
    page_size: int = 20


@dataclass(frozen=True)
class TaskQuery:
    q: str | None = None
    statuses: list[TaskStatus] = field(default_factory=list)
    priorities: list[Priority] = field(default_factory=list)
    project_ids: list[UUID] = field(default_factory=list)
    assignee_ids: list[UUID] = field(default_factory=list)
    overdue: bool | None = None
    today: date | None = None
    due_before: date | None = None
    due_after: date | None = None
    sort: str = "createdAt"
    descending: bool = False
    page: int = 1
    page_size: int = 20
    with_total: bool = True  # False when the caller never reads the total: it saves a count


@dataclass(frozen=True)
class ActivityQuery:
    page: int = 1
    page_size: int = 10


@dataclass(frozen=True)
class TaskTotals:
    """Dashboard aggregates over all tasks, computed in one pass (BR-304, FR-310)."""

    total: int
    done: int
    open: int
    overdue: int
