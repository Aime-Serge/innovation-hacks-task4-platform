from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, Request, Response

from app.api.deps import ContainerDep, CurrentActor, UserId, enforce_rate_limit
from app.api.docs import errors
from app.core.errors import RegistrationDisabled
from app.domain.enums import Theme
from app.domain.queries import UserQuery
from app.domain.unset import UNSET
from app.schemas.common import PageOut
from app.schemas.profiles import ProfileBlock, ProfileBlockDraft, ValidationOk
from app.schemas.users import (
    RegistrationCheck,
    UserCreate,
    UserListQuery,
    UserOut,
    UserUpdate,
)
from app.services.authz import Actor
from app.services.users import Registration, RegistrationProfile, UserChanges


def _sees_email(actor: Actor, user_id: UUID) -> bool:
    """BR-403: an email is shown to its owner and to leads, and is null for everyone else."""
    return actor.is_lead or actor.id == user_id


router = APIRouter(prefix="/users", tags=["Users"])
_WRITE = ("PAYLOAD_TOO_LARGE", "UNSUPPORTED_MEDIA_TYPE", "MALFORMED_REQUEST", "INTERNAL_ERROR")


def _profile_input(block: ProfileBlock | ProfileBlockDraft) -> RegistrationProfile:
    return RegistrationProfile(
        discipline=block.discipline,
        seniority=block.seniority,
        employment_status=block.employment_status,
        company_name=block.company_name,
        job_title=block.job_title,
        country=block.country,
        city=block.city,
        time_zone=block.time_zone,
    )


@router.post(
    "/validate",
    response_model=ValidationOk,
    summary="Check one registration step",
    description=(
        "Validate the fields of registration step 1 (account) or step 2 (professional details "
        "and consent) and create nothing. Every problem comes back at once as a `422` with a "
        "per-field message; a valid step returns `200`. A duplicate email is not reported here: "
        "`POST /users` answers `409 EMAIL_ALREADY_EXISTS`. Limited to 30 checks per minute per "
        "client."
    ),
    responses=errors("VALIDATION_ERROR", "RATE_LIMITED", "REGISTRATION_DISABLED", *_WRITE),
)
async def validate_registration(
    payload: RegistrationCheck, request: Request, container: ContainerDep
) -> ValidationOk:
    if not container.settings.registration_enabled:
        raise RegistrationDisabled("Registration is switched off.")  # BR-414
    enforce_rate_limit(
        request, container, "validate", attempts=container.settings.rate_limit_attempts * 6
    )
    container.users.validate_registration(
        payload.step,
        Registration(
            given_name=payload.given_name,
            family_name=payload.family_name,
            email=payload.email,
            password=payload.password,
            profile=_profile_input(payload.profile) if payload.profile else None,
            terms_accepted=payload.terms_accepted,
            age_confirmed=payload.age_confirmed,
        ),
    )
    return ValidationOk(valid=True)


@router.post(
    "",
    status_code=201,
    response_model=UserOut,
    summary="Register a user",
    description=(
        "Create an account and its professional profile in one request (S-A). No token is "
        "needed. The role is always `developer`; only a lead can change it later. The password "
        "must be 12 to 128 characters and not equal to the email or the name. `termsAccepted` "
        "and `ageConfirmed` must be true; the terms version and time are stored, and no birth "
        "date is collected. Company and job title are required when the status is `employed` "
        "or `freelance`. Returns `201` with a `Location` header. "
        "Limited to 5 attempts per minute per client."
    ),
    responses={
        **errors(
            "EMAIL_ALREADY_EXISTS",
            "REGISTRATION_DISABLED",
            "VALIDATION_ERROR",
            "RATE_LIMITED",
            *_WRITE,
        )
    },
)
async def register(
    payload: UserCreate, request: Request, response: Response, container: ContainerDep
) -> UserOut:
    if not container.settings.registration_enabled:
        raise RegistrationDisabled("Registration is switched off.")  # BR-414
    enforce_rate_limit(request, container, "register")
    member = await container.users.register(
        Registration(
            given_name=payload.given_name,
            family_name=payload.family_name,
            email=payload.email,
            password=payload.password,
            profile=_profile_input(payload.profile),
            terms_accepted=payload.terms_accepted,
            age_confirmed=payload.age_confirmed,
        ),
        theme=payload.preferences.theme if payload.preferences else Theme.SYSTEM,
        avatar_url=payload.avatar_url,
    )
    response.headers["Location"] = f"/api/v1/users/{member.user.id}"
    return UserOut.of(member, show_email=True)  # the new account's owner


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
    page = await container.users.list_members(
        actor.id,
        UserQuery(
            q=query.q,
            role=query.role,
            match_email=actor.is_lead,  # BR-403: no email search, so no email oracle
            sort=query.sort_field if actor.is_lead or query.sort_field != "email" else "name",
            descending=query.descending,
            page=query.page,
            page_size=query.page_size,
        ),
    )
    return PageOut(
        items=[UserOut.of(m, show_email=_sees_email(actor, m.user.id)) for m in page.items],
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
    member = await container.users.get_member(actor.id, user_id)
    return UserOut.of(member, show_email=_sees_email(actor, user_id))


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
    await container.users.update(actor, user_id, changes)
    member = await container.users.get_member(actor.id, user_id)
    return UserOut.of(member, show_email=_sees_email(actor, user_id))


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
