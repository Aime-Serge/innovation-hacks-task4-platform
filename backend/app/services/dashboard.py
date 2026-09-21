from dataclasses import dataclass
from datetime import timedelta

from app.core.clock import Clock
from app.domain.enums import ProjectStatus, TaskStatus
from app.domain.models import Task
from app.repositories.base import TaskQuery, UnitOfWork
from app.services import transaction
from app.services.transaction import UowFactory

OPEN_STATUSES = [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW]
UPCOMING_DAYS = 7


@dataclass(frozen=True)
class DashboardSummary:
    active_projects: int
    open_tasks: int
    overdue_tasks: int
    completion_rate: int
    upcoming_deadlines: list[Task]


class DashboardService:
    def __init__(self, uow: UowFactory, clock: Clock) -> None:
        self._uow = uow
        self._clock = clock

    async def summary(self) -> DashboardSummary:
        today = self._clock.today()  # BR-307: the date comes from the injected clock

        async def work(uow: UnitOfWork) -> DashboardSummary:
            active = await uow.projects.count([ProjectStatus.ACTIVE])
            totals = await uow.tasks.totals(today)  # one aggregate query (BR-304)
            upcoming = await uow.tasks.list(
                TaskQuery(
                    statuses=OPEN_STATUSES,
                    due_after=today,
                    due_before=today + timedelta(days=UPCOMING_DAYS),
                    sort="dueDate",
                    page_size=50,
                    with_total=False,  # only the items are shown
                )
            )
            rate = 0 if totals.total == 0 else round(totals.done / totals.total * 100)
            return DashboardSummary(active, totals.open, totals.overdue, rate, upcoming.items)

        return await transaction.read(self._uow, work)
