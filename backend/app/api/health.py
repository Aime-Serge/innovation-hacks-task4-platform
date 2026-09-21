from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from app.api.deps import ContainerDep
from app.api.docs import errors
from app.core.errors import ServiceUnavailable

router = APIRouter(tags=["Health"])


class HealthOut(BaseModel):
    status: Literal["ok"]


@router.get(
    "/healthz",
    response_model=HealthOut,
    summary="Liveness",
    description="The process is up. Not versioned, no token needed.",
)
async def healthz() -> HealthOut:
    return HealthOut(status="ok")


@router.get(
    "/readyz",
    response_model=HealthOut,
    summary="Readiness",
    description="Every dependency answers. `503 SERVICE_UNAVAILABLE` when not ready.",
    responses=errors("SERVICE_UNAVAILABLE"),
)
async def readyz(container: ContainerDep) -> HealthOut:
    if not await container.is_ready():
        raise ServiceUnavailable("A dependency is not ready.")
    return HealthOut(status="ok")
