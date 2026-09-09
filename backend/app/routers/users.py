from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import get_current_user
from app.exceptions import ConflictError, NotFoundError
from app.models.user import UserInDB, UserOut, UserUpdate
from app.repositories.user_repo import user_repository
from app.security import hash_password

# Registration lives at POST /auth/register (it also issues a session).
# Everything here requires an authenticated session.
router = APIRouter(prefix="/users", tags=["users"], dependencies=[Depends(get_current_user)])


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
    if user_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="You can only edit your own account.")

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
    if payload.password is not None:
        user.password_hash = hash_password(payload.password)

    return user_repository.update(user).to_out()


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: UUID, current_user: UserInDB = Depends(get_current_user)) -> None:
    if user_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="You can only delete your own account.")

    user = user_repository.get(user_id)
    if user is None:
        raise NotFoundError(f"User '{user_id}' not found.")
    user_repository.delete(user_id)
