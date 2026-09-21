from fastapi import APIRouter

from app.api.deps import ContainerDep, CurrentUser
from app.api.docs import errors
from app.domain.queries import ActivityQuery
from app.schemas.common import PageOut
from app.schemas.misc import ActivityOut, ActivityParams

router = APIRouter(prefix="/activity", tags=["Dashboard"])


@router.get(
    "",
    response_model=PageOut[ActivityOut],
    summary="Recent activity",
    description=(
        "Newest first. Records project created, task created, status changed and task completed. "
        "`limit` (default 10, maximum 50) is the page size of page 1."
    ),
    responses=errors("UNAUTHENTICATED", "VALIDATION_ERROR", "INTERNAL_ERROR"),
)
async def recent_activity(
    query: ActivityParams, _: CurrentUser, container: ContainerDep
) -> PageOut[ActivityOut]:
    page = await container.activity.list(ActivityQuery(page=1, page_size=query.limit))
    return PageOut(
        items=[ActivityOut.of(item) for item in page.items],
        page=1,
        page_size=query.limit,
        total=page.total,
    )
