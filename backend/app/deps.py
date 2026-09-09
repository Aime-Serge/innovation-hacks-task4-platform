from fastapi import Cookie, Header, HTTPException, status

from app.models.user import UserInDB
from app.repositories.user_repo import user_repository
from app.security import decode_access_token

ACCESS_TOKEN_COOKIE = "access_token"


def _extract_token(
    access_token: str | None,
    authorization: str | None,
) -> str | None:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[len("bearer ") :].strip()
    return access_token


def get_current_user(
    access_token: str | None = Cookie(default=None, alias=ACCESS_TOKEN_COOKIE),
    authorization: str | None = Header(default=None),
) -> UserInDB:
    """Auth dependency for protected routes. Accepts the session either as
    the httpOnly cookie the frontend uses, or as an `Authorization: Bearer`
    header for API clients (Postman, curl, the demo script)."""
    token = _extract_token(access_token, authorization)
    if token is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")

    user_id = decode_access_token(token)
    if user_id is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session.")

    user = user_repository.get(user_id)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session.")

    return user
