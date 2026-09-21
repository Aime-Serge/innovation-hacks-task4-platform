from fastapi import APIRouter

from app.api.deps import ContainerDep, CurrentUser
from app.api.docs import errors
from app.schemas.misc import SummaryOut
from app.schemas.tasks import TaskOut

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get(
    "/summary",
    response_model=SummaryOut,
    summary="Dashboard summary",
    description=(
        "Active projects, open tasks, overdue tasks, completion rate, and the open tasks due in "
        "the next 7 days, soonest first."
    ),
    responses=errors("UNAUTHENTICATED", "INTERNAL_ERROR"),
)
async def summary(_: CurrentUser, container: ContainerDep) -> SummaryOut:
    data = await container.dashboard.summary()
    return SummaryOut(
        active_projects=data.active_projects,
        open_tasks=data.open_tasks,
        overdue_tasks=data.overdue_tasks,
        completion_rate=data.completion_rate,
        upcoming_deadlines=[TaskOut.of(task) for task in data.upcoming_deadlines],
    )
