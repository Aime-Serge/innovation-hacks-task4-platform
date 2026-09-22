"""The signed-in person's profile, preferences, privacy, password and account (section 5)."""

from fastapi import APIRouter, Request, Response

from app.api.deps import ContainerDep, CurrentUser, enforce_rate_limit
from app.api.docs import errors
from app.schemas.profiles import (
    AccountDelete,
    PasswordChange,
    PreferencesReplace,
    PrivacyReplace,
    ProfileUpdate,
    SkillsReplace,
)
from app.schemas.users import MeOut
from app.services.profiles import ProfileChanges

router = APIRouter(prefix="/me", tags=["Me"])
_WRITE = ("PAYLOAD_TOO_LARGE", "UNSUPPORTED_MEDIA_TYPE", "MALFORMED_REQUEST", "INTERNAL_ERROR")
_OWN = ("UNAUTHENTICATED", "VALIDATION_ERROR", *_WRITE)


async def _me(container: ContainerDep, user: CurrentUser) -> MeOut:
    fresh, profile, stats = await container.profiles.me(user.id)
    return MeOut.build(fresh, profile, stats)


@router.get(
    "",
    response_model=MeOut,
    summary="My account and profile",
    description=(
        "The signed-in person's own view: the user, the professional profile, statistics "
        "(projects owned, tasks done and open), the completeness percentage with the next "
        "suggested step, and the privacy switch. Only the owner sees statistics and completeness."
    ),
    responses=errors("UNAUTHENTICATED", "NOT_FOUND", "INTERNAL_ERROR"),
)
async def get_me(user: CurrentUser, container: ContainerDep) -> MeOut:
    return await _me(container, user)


@router.patch(
    "/profile",
    response_model=MeOut,
    summary="Edit my profile",
    description=(
        "Partial update of the names, professional details, headline, about text and links. "
        "Send only what changes; `null` clears an optional field. The display name is rebuilt "
        "from the given and family names. Company and job title stay required while the status "
        "is `employed` or `freelance`. Links are `https`; GitHub and LinkedIn must point to "
        "that provider. Text is plain text and is never interpreted as markup."
    ),
    responses=errors(*_OWN, "NOT_FOUND"),
)
async def update_profile(
    payload: ProfileUpdate, user: CurrentUser, container: ContainerDep
) -> MeOut:
    sent = payload.model_dump(exclude_unset=True, exclude={"links"})
    links = payload.links.model_dump(exclude_unset=True) if payload.links is not None else {}
    changes = ProfileChanges(**sent, **links)  # a field left out stays UNSET: nothing changes
    await container.profiles.update_profile(user.id, changes)
    return await _me(container, user)


@router.put(
    "/skills",
    response_model=MeOut,
    summary="Replace my skills",
    description=(
        "Replace the whole list, in order. At most 10 skills of 1 to 30 characters each, unique "
        "ignoring case. The profile row is locked while the list is replaced, so two requests at "
        "once cannot pass the limit."
    ),
    responses=errors(*_OWN, "NOT_FOUND"),
)
async def replace_skills(
    payload: SkillsReplace, user: CurrentUser, container: ContainerDep
) -> MeOut:
    await container.profiles.replace_skills(user.id, payload.skills)
    return await _me(container, user)


@router.put(
    "/preferences",
    response_model=MeOut,
    summary="Save my preferences",
    description=(
        "Theme (`light`, `dark` or `system`) and time zone, saved per account. The header theme "
        "toggle may also keep using `PATCH /users/{userId}`; both write the same setting."
    ),
    responses=errors(*_OWN, "NOT_FOUND"),
)
async def set_preferences(
    payload: PreferencesReplace, user: CurrentUser, container: ContainerDep
) -> MeOut:
    await container.profiles.set_preferences(user.id, payload.theme, payload.time_zone)
    return await _me(container, user)


@router.put(
    "/privacy",
    response_model=MeOut,
    summary="Save my privacy switch",
    description=(
        "`showProfessionalDetails` false hides discipline, seniority, company, job title, "
        "location, skills and links from other members at once, on the member page, in "
        "`GET /users` and in `GET /users/{userId}`. Your own view never changes."
    ),
    responses=errors(*_OWN, "NOT_FOUND"),
)
async def set_privacy(payload: PrivacyReplace, user: CurrentUser, container: ContainerDep) -> MeOut:
    await container.profiles.set_privacy(user.id, payload.show_professional_details)
    return await _me(container, user)


@router.post(
    "/password",
    status_code=204,
    summary="Change my password",
    description=(
        "Needs the current password (`403 INVALID_CREDENTIALS` when it is wrong, so the client "
        "keeps its session). Every session ends except the one whose `refreshToken` is sent; "
        "without a token every session ends. Limited to 5 attempts per minute per client."
    ),
    responses=errors(*_OWN, "INVALID_CREDENTIALS:403", "RATE_LIMITED", "NOT_FOUND"),
)
async def change_password(
    payload: PasswordChange, request: Request, user: CurrentUser, container: ContainerDep
) -> Response:
    enforce_rate_limit(request, container, "password", str(user.id))
    await container.profiles.change_password(
        user.id, payload.current_password, payload.new_password, payload.refresh_token
    )
    return Response(status_code=204)


@router.delete(
    "/sessions",
    status_code=204,
    summary="Sign out of all devices",
    description="Revoke every refresh-token family of the person, including the current one.",
    responses=errors("UNAUTHENTICATED", "INTERNAL_ERROR"),
)
async def revoke_sessions(user: CurrentUser, container: ContainerDep) -> Response:
    await container.profiles.revoke_sessions(user.id)
    return Response(status_code=204)


@router.post(
    "/delete",
    status_code=204,
    summary="Delete my account",
    description=(
        "Needs the password (`403 INVALID_CREDENTIALS` when wrong). Blocked with `409 "
        "USER_OWNS_PROJECTS` while the person owns projects, and with `409 LAST_LEAD` for the "
        "last lead. Otherwise tasks assigned to the person become unassigned and the account, "
        "profile and sessions are removed. Limited to 5 attempts per minute per client."
    ),
    responses=errors(
        *_OWN,
        "INVALID_CREDENTIALS:403",
        "USER_OWNS_PROJECTS",
        "LAST_LEAD",
        "RATE_LIMITED",
        "NOT_FOUND",
    ),
)
async def delete_account(
    payload: AccountDelete, request: Request, user: CurrentUser, container: ContainerDep
) -> Response:
    enforce_rate_limit(request, container, "delete-account", str(user.id))
    await container.profiles.delete_account(user.id, payload.password)
    return Response(status_code=204)
