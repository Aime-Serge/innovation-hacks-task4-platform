"""Pure business rules (BR-03, BR-04, BR-204, BR-211). No I/O, no HTTP."""

from datetime import date, datetime

from app.domain.enums import Priority, TaskStatus
from app.domain.models import Progress, Task

# The workflow of section 3. Anything not listed is rejected (BR-204).
ALLOWED_TRANSITIONS: dict[TaskStatus, tuple[TaskStatus, ...]] = {
    TaskStatus.TODO: (TaskStatus.IN_PROGRESS,),
    TaskStatus.IN_PROGRESS: (TaskStatus.IN_REVIEW,),
    TaskStatus.IN_REVIEW: (TaskStatus.IN_PROGRESS, TaskStatus.DONE),
    TaskStatus.DONE: (TaskStatus.IN_PROGRESS,),
}

PRIORITY_RANK: dict[Priority, int] = {
    Priority.LOW: 0,
    Priority.MEDIUM: 1,
    Priority.HIGH: 2,
    Priority.URGENT: 3,
}


def allowed_next(status: TaskStatus) -> tuple[TaskStatus, ...]:
    return ALLOWED_TRANSITIONS[status]


def can_transition(current: TaskStatus, requested: TaskStatus) -> bool:
    return requested in ALLOWED_TRANSITIONS[current]


def completed_at_after(
    current: TaskStatus, requested: TaskStatus, previous: datetime | None, now: datetime
) -> datetime | None:
    """BR-211: set on entering done, cleared on leaving it."""
    if requested is TaskStatus.DONE:
        return now
    if current is TaskStatus.DONE:
        return None
    return previous


def progress(total_tasks: int, done_tasks: int) -> Progress:
    """BR-03: done over total, rounded to a whole percent; no tasks is 0%."""
    percent = 0 if total_tasks == 0 else round(done_tasks / total_tasks * 100)
    return Progress(total_tasks, done_tasks, percent)


def is_overdue(task: Task, today: date) -> bool:
    """BR-04: due before today and not done."""
    return (
        task.due_date is not None and task.status is not TaskStatus.DONE and task.due_date < today
    )
