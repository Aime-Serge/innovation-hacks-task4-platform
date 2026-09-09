from fastapi import APIRouter, status

from app.exceptions import ConflictError
from app.models.user import UserCreate, UserInDB, UserOut
from app.repositories.user_repo import user_repository
from app.security import hash_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate) -> UserOut:
    if user_repository.get_by_email(payload.email):
        raise ConflictError(f"A user with email '{payload.email}' already exists.")

    user = user_repository.create(
        UserInDB(
            name=payload.name,
            email=payload.email,
            password_hash=hash_password(payload.password),
        )
    )
    return user.to_out()
