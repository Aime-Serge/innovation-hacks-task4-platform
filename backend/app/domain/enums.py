"""Enum values are identical to Task 1 (BR-01, BR-02)."""

from enum import StrEnum


class Role(StrEnum):
    DEVELOPER = "developer"
    LEAD = "lead"


class Theme(StrEnum):
    LIGHT = "light"
    DARK = "dark"
    SYSTEM = "system"


class ProjectStatus(StrEnum):
    PLANNED = "planned"
    ACTIVE = "active"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"


class TaskStatus(StrEnum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    IN_REVIEW = "in_review"
    DONE = "done"


class Priority(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class ActivityType(StrEnum):
    CREATED = "created"
    STATUS_CHANGED = "status_changed"
    COMPLETED = "completed"


class Discipline(StrEnum):
    BACKEND = "backend"
    FRONTEND = "frontend"
    FULL_STACK = "full_stack"
    MOBILE = "mobile"
    DEVOPS_CLOUD = "devops_cloud"
    DATA_AI = "data_ai"
    SECURITY = "security"
    QA = "qa"
    OTHER = "other"


class Seniority(StrEnum):
    STUDENT_INTERN = "student_intern"
    JUNIOR = "junior"
    MID = "mid"
    SENIOR = "senior"
    LEAD_OR_ABOVE = "lead_or_above"


class EmploymentStatus(StrEnum):
    EMPLOYED = "employed"
    FREELANCE = "freelance"
    STUDENT = "student"
    BETWEEN_ROLES = "between_roles"


def _agree_with_the_lists() -> None:
    """Fail at import when an enum and `profile_lists.json` disagree (ADR-607)."""
    from app.domain import lists

    for enum, values in (
        (Discipline, lists.DISCIPLINES),
        (Seniority, lists.SENIORITIES),
        (EmploymentStatus, lists.EMPLOYMENT_STATUSES),
    ):
        if tuple(member.value for member in enum) != values:
            raise RuntimeError(f"{enum.__name__} does not match config/profile_lists.json")


_agree_with_the_lists()
