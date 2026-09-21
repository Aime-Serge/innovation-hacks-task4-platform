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
