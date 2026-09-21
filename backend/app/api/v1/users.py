from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, Request, Response

from app.api.deps import ContainerDep, CurrentActor, UserId, enforce_rate_limit
from app.api.docs import errors
from app.domain.enums import Theme
from app.domain.queries import UserQuery
from app.domain.unset import UNSET
from app.schemas.common import PageOut
from app.schemas.users import UserCreate, UserListQuery, UserOut, UserUpdate
from app.services.authz import Actor
from app.services.users import UserChanges


def _sees_email(actor: Actor, user_id: UUID) -> bool:
    """BR-403: an email is shown to its owner and to leads, and is null for everyone else."""
    return actor.is_lead or actor.id == user_id


router = APIRouter(prefix="/users", tags=["Users"])
_WRITE = ("PAYLOAD_TOO_LARGE", "UNSUPPORTED_MEDIA_TYPE", "MALFORMED_REQUEST", "INTERNAL_ERROR")


@router.post(
    "",
    status_code=201,
    response_model=UserOut,
    summary="Register a user",
    description=(
        "Create an account. No token is needed. The role is always `developer`; only a lead can "
        "change it later. The password must be 12 to 128 characters and not equal to the email. "
        "Returns `201` with a `Location` header. "
        "Limited to 5 attempts per minute per client and email."
    ),
    responses={**errors("EMAIL_ALREADY_EXISTS", "VALIDATION_ERROR", "RATE_LIMITED", *_WRITE)},
)
async def register(
    payload: UserCreate, request: Request, response: Response, container: ContainerDep
) -> UserOut:
    enforce_rate_limit(request, container, "register")
    user = await container.users.register(
        payload.name,
        payload.email,
        payload.password,
        payload.avatar_url,
        payload.preferences.theme if payload.preferences else Theme.SYSTEM,
    )
    response.headers["Location"] = f"/api/v1/users/{user.id}"
    return UserOut.of(user, show_email=True)  # the new account's owner


@router.get(
    "",
    response_model=PageOut[UserOut],
    summary="List users",
    description=(
        "Paginated. Filter by `role`; search `q` matches name and email, case-insensitively."
    ),
    responses=errors("UNAUTHENTICATED", "VALIDATION_ERROR", "INTERNAL_ERROR"),
)
async def list_users(
    query: Annotated[UserListQuery, Query()], actor: CurrentActor, container: ContainerDep
) -> PageOut[UserOut]:
    page = await container.users.list(
        UserQuery(
            q=query.q,
            role=query.role,
            match_email=actor.is_lead,  # BR-403: no email search, so no email oracle
            sort=query.sort_field if actor.is_lead or query.sort_field != "email" else "name",
            descending=query.descending,
            page=query.page,
            page_size=query.page_size,
        )
    )
    return PageOut(
        items=[UserOut.of(user, show_email=_sees_email(actor, user.id)) for user in page.items],
        page=page.page,
        page_size=page.page_size,
        total=page.total,
    )


@router.get(
    "/{userId}",
    response_model=UserOut,
    summary="Get a user",
    description="Return one user, or `404 NOT_FOUND`.",
    responses=errors("UNAUTHENTICATED", "NOT_FOUND", "VALIDATION_ERROR", "INTERNAL_ERROR"),
)
async def get_user(user_id: UserId, actor: CurrentActor, container: ContainerDep) -> UserOut:
    user = await container.users.get(user_id)
    return UserOut.of(user, show_email=_sees_email(actor, user.id))


@router.patch(
    "/{userId}",
    response_model=UserOut,
    summary="Update a user",
    description=(
        "Partial update. You may change your own name, avatar and preferences. Only a lead may "
        "change another user or any role. The last lead cannot be demoted."
    ),
    responses=errors(
        "UNAUTHENTICATED", "FORBIDDEN", "NOT_FOUND", "LAST_LEAD", "VALIDATION_ERROR", *_WRITE
    ),
)
async def update_user(
    user_id: UserId, payload: UserUpdate, actor: CurrentActor, container: ContainerDep
) -> UserOut:
    given = payload.model_fields_set
    changes = UserChanges(
        name=payload.name if "name" in given and payload.name is not None else UNSET,
        avatar_url=payload.avatar_url if "avatar_url" in given else UNSET,
        theme=payload.preferences.theme if payload.preferences is not None else UNSET,
        role=payload.role if payload.role is not None else UNSET,
    )
    user = await container.users.update(actor, user_id, changes)
    return UserOut.of(user, show_email=_sees_email(actor, user.id))


@router.delete(
    "/{userId}",
    status_code=204,
    summary="Delete a user",
    description=(
        "Lead only. A user who owns projects, or the last lead, cannot be deleted. "
        "Their tasks become unassigned."
    ),
    responses=errors(
        "UNAUTHENTICATED",
        "FORBIDDEN",
        "NOT_FOUND",
        "USER_OWNS_PROJECTS",
        "LAST_LEAD",
        "VALIDATION_ERROR",
        "INTERNAL_ERROR",
    ),
)
async def delete_user(user_id: UserId, actor: CurrentActor, container: ContainerDep) -> Response:
    await container.users.delete(actor, user_id)
    return Response(status_code=204)
