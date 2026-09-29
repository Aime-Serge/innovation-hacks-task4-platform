from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.config import get_settings
from app.deps import ACCESS_TOKEN_COOKIE, get_current_user
from app.exceptions import ConflictError
from app.models.auth import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    ResetPasswordRequest,
    TokenOut,
    UserLogin,
)
from app.models.user import UserCreate, UserInDB, UserOut
from app.repositories.user_repo import user_repository
from app.security import (
    DUMMY_PASSWORD_HASH,
    RESET_TOKEN_EXPIRE_MINUTES,
    create_access_token,
    generate_reset_token,
    hash_password,
    hash_reset_token,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_session_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    is_production = settings.app_env == "production"
    response.set_cookie(
        key=ACCESS_TOKEN_COOKIE,
        value=token,
        httponly=True,
        secure=is_production,
        samesite="none" if is_production else "lax",
        max_age=settings.access_token_expire_minutes * 60,
        path="/",
    )


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate) -> UserOut:
    """Creates the account and nothing else: no session cookie and no token.
    The user signs in through /auth/login afterwards — registering is not
    a login, and issuing a session here would let the client skip the
    login step entirely."""
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


@router.post("/login", response_model=TokenOut)
def login(payload: UserLogin, response: Response) -> TokenOut:
    user = user_repository.get_by_email(payload.email)
    # Constant-shape response: run verify_password even when no user exists
    # (against a dummy hash) so login timing doesn't reveal account existence.
    password_ok = verify_password(
        payload.password, user.password_hash if user else DUMMY_PASSWORD_HASH
    )

    if user is None or not password_ok:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    token = create_access_token(user.id)
    _set_session_cookie(response, token)
    return TokenOut(access_token=token, user=user.to_out())


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    response.delete_cookie(ACCESS_TOKEN_COOKIE, path="/")


@router.get("/me", response_model=UserOut)
def me(current_user: UserInDB = Depends(get_current_user)) -> UserOut:
    return current_user.to_out()


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(payload: ForgotPasswordRequest) -> ForgotPasswordResponse:
    settings = get_settings()
    message = "If an account exists for that email, a password reset link has been generated."
    user = user_repository.get_by_email(payload.email)
    if user is None:
        return ForgotPasswordResponse(message=message)

    raw_token, token_hash = generate_reset_token()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)
    user_repository.set_reset_token(user.id, token_hash, expires_at)

    reset_url = f"{settings.frontend_url}/reset-password?token={raw_token}"
    return ForgotPasswordResponse(message=message, dev_reset_url=reset_url)


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(payload: ResetPasswordRequest) -> None:
    invalid = HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset link.")

    token_hash = hash_reset_token(payload.token)
    user = user_repository.get_by_reset_token_hash(token_hash)
    if user is None or user.password_reset_expires_at is None:
        raise invalid

    expires_at = user.password_reset_expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        user_repository.set_reset_token(user.id, None, None)
        raise invalid

    user.password_hash = hash_password(payload.new_password)
    user.password_reset_token_hash = None
    user.password_reset_expires_at = None
    user_repository.update(user)
