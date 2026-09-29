from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status

from app.config import get_settings
from app.deps import get_current_user
from app.exceptions import ConflictError, NotFoundError
from app.models.user import ChangePasswordRequest, UserInDB, UserOut, UserUpdate
from app.repositories.user_repo import user_repository
from app.security import hash_password, verify_password

# Registration lives at POST /auth/register (it also issues a session).
# Everything here requires an authenticated session.
router = APIRouter(prefix="/users", tags=["users"], dependencies=[Depends(get_current_user)])


def _require_self(user_id: UUID, current_user: UserInDB, action: str) -> None:
    if user_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=f"You can only {action} your own account.")


@router.get("", response_model=list[UserOut])
def list_users() -> list[UserOut]:
    """Any authenticated user can list users — used by the frontend to
    populate the task-assignee picker. Only name/email/id are exposed
    (UserOut never includes password_hash)."""
    return [user.to_out() for user in user_repository.list()]


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: UUID) -> UserOut:
    user = user_repository.get(user_id)
    if user is None:
        raise NotFoundError(f"User '{user_id}' not found.")
    return user.to_out()


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: UUID, payload: UserUpdate, current_user: UserInDB = Depends(get_current_user)
) -> UserOut:
    _require_self(user_id, current_user, "edit")

    user = user_repository.get(user_id)
    if user is None:
        raise NotFoundError(f"User '{user_id}' not found.")

    if payload.email is not None and payload.email.lower() != user.email.lower():
        existing = user_repository.get_by_email(payload.email)
        if existing is not None:
            raise ConflictError(f"A user with email '{payload.email}' already exists.")
        user.email = payload.email

    if payload.name is not None:
        user.name = payload.name

    return user_repository.update(user).to_out()


@router.post("/{user_id}/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    user_id: UUID,
    payload: ChangePasswordRequest,
    current_user: UserInDB = Depends(get_current_user),
) -> None:
    """Distinct from /auth/forgot-password + /auth/reset-password: this
    is 'I know my current password and want a new one,' so it requires
    proving that — unlike the generic profile PATCH, which deliberately
    has no password field at all (see UserUpdate's docstring)."""
    _require_self(user_id, current_user, "change the password for")

    user = user_repository.get(user_id)
    if user is None:
        raise NotFoundError(f"User '{user_id}' not found.")

    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect.")

    user.password_hash = hash_password(payload.new_password)
    user_repository.update(user)


@router.post("/{user_id}/avatar", response_model=UserOut)
async def upload_avatar(
    user_id: UUID,
    file: UploadFile = File(...),
    current_user: UserInDB = Depends(get_current_user),
) -> UserOut:
    _require_self(user_id, current_user, "change the avatar for")

    settings = get_settings()
    if file.content_type not in settings.avatar_allowed_mime_type_list:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Avatar must be one of: {', '.join(settings.avatar_allowed_mime_type_list)}.",
        )

    data = await file.read()
    if len(data) > settings.avatar_max_bytes:
        raise HTTPException(
            status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"Avatar must be under {settings.avatar_max_bytes // 1000} KB.",
        )
    if len(data) == 0:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Empty file.")

    user_repository.set_avatar(user_id, data, file.content_type)
    user = user_repository.get(user_id)
    if user is None:
        raise NotFoundError(f"User '{user_id}' not found.")
    return user.to_out()


@router.get("/{user_id}/avatar")
def get_avatar(user_id: UUID) -> Response:
    avatar = user_repository.get_avatar(user_id)
    if avatar is None:
        raise NotFoundError("No avatar set for this user.")
    data, mime = avatar
    return Response(content=data, media_type=mime)


@router.delete("/{user_id}/avatar", response_model=UserOut)
def delete_avatar(user_id: UUID, current_user: UserInDB = Depends(get_current_user)) -> UserOut:
    _require_self(user_id, current_user, "change the avatar for")
    user_repository.clear_avatar(user_id)
    user = user_repository.get(user_id)
    if user is None:
        raise NotFoundError(f"User '{user_id}' not found.")
    return user.to_out()


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: UUID, current_user: UserInDB = Depends(get_current_user)) -> None:
    _require_self(user_id, current_user, "delete")

    user = user_repository.get(user_id)
    if user is None:
        raise NotFoundError(f"User '{user_id}' not found.")
    user_repository.delete(user_id)
