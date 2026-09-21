"""Request dependencies: the container, the current user, the rate limit (section 7)."""

from typing import Annotated
from uuid import UUID

from fastapi import Depends, Path, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.container import Container
from app.core.errors import Unauthenticated
from app.domain.models import User
from app.services.authz import Actor

bearer = HTTPBearer(auto_error=False, description="A token from `POST /api/v1/auth/login`.")


def get_container(request: Request) -> Container:
    container: Container = request.app.state.container
    return container


ContainerDep = Annotated[Container, Depends(get_container)]


async def current_user(
    request: Request,
    container: ContainerDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise Unauthenticated("The access token is missing, invalid or expired.")
    user = await container.auth.authenticate(credentials.credentials)
    request.scope.setdefault("state", {})["user_id"] = str(user.id)
    return user


CurrentUser = Annotated[User, Depends(current_user)]


async def current_actor(user: CurrentUser) -> Actor:
    return Actor(user.id, user.role)


CurrentActor = Annotated[Actor, Depends(current_actor)]

# Path parameters are camelCase like every other name on the wire (section 6).
UserId = Annotated[UUID, Path(alias="userId", description="The user's id.")]
ProjectId = Annotated[UUID, Path(alias="projectId", description="The project's id.")]
TaskId = Annotated[UUID, Path(alias="taskId", description="The task's id.")]


def enforce_rate_limit(
    request: Request, container: Container, scope: str, email: str | None = None
) -> None:
    """NFR-216: per client, and per email for login. Counts every attempt, successful or not.

    Registration passes no email, so varying the address cannot dodge the limit.
    """
    client = request.client.host if request.client else "unknown"
    suffix = f":{email.strip().lower()}" if email is not None else ""
    container.limiter.check(f"{scope}:{client}{suffix}")
