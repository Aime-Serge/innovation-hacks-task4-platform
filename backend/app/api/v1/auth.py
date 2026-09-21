import hashlib

from fastapi import APIRouter, Request, Response

from app.api.deps import ContainerDep, CurrentUser, enforce_rate_limit
from app.api.docs import errors
from app.schemas.misc import LoginRequest, RefreshRequest, TokenOut
from app.schemas.users import UserOut
from app.services.session_service import SessionTokens


def _token_out(issued: SessionTokens) -> TokenOut:
    return TokenOut(
        access_token=issued.access_token,
        expires_in=issued.expires_in,
        refresh_token=issued.refresh_token,
        refresh_expires_in=issued.refresh_expires_in,
    )


router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/login",
    response_model=TokenOut,
    summary="Log in",
    description=(
        "Exchange an email and password for a short-lived Bearer token (15 minutes). "
        "An unknown email and a wrong password give the same `401 INVALID_CREDENTIALS`. "
        "Limited to 5 attempts per minute per client and email."
    ),
    responses={
        200: {
            "description": "The token.",
            "content": {
                "application/json": {
                    "example": {
                        "accessToken": "eyJhbGciOi...",
                        "tokenType": "bearer",
                        "expiresIn": 900,
                        "refreshToken": "q1w2e3...",
                        "refreshExpiresIn": 604800,
                    }
                }
            },
        },
        **errors(
            "INVALID_CREDENTIALS",
            "VALIDATION_ERROR",
            "RATE_LIMITED",
            "MALFORMED_REQUEST",
            "PAYLOAD_TOO_LARGE",
            "UNSUPPORTED_MEDIA_TYPE",
            "INTERNAL_ERROR",
        ),
    },
)
async def login(payload: LoginRequest, request: Request, container: ContainerDep) -> TokenOut:
    enforce_rate_limit(request, container, "login", payload.email)
    issued = await container.sessions.login(payload.email, payload.password)
    return _token_out(issued)


@router.get(
    "/me",
    response_model=UserOut,
    summary="Current user",
    description="Return the user the token belongs to. Useful to check a token is still valid.",
    responses=errors("UNAUTHENTICATED", "INTERNAL_ERROR"),
)
async def me(user: CurrentUser) -> UserOut:
    return UserOut.of(user, show_email=True)  # the caller's own profile


@router.post(
    "/refresh",
    response_model=TokenOut,
    summary="Refresh the session",
    description=(
        "Exchange a refresh token for a new access token and a new refresh token. Each refresh "
        "token works once: using it again revokes the whole session. Limited to 5 attempts per "
        "minute per token."
    ),
    responses=errors(
        "REFRESH_TOKEN_INVALID",
        "VALIDATION_ERROR",
        "RATE_LIMITED",
        "MALFORMED_REQUEST",
        "PAYLOAD_TOO_LARGE",
        "UNSUPPORTED_MEDIA_TYPE",
        "INTERNAL_ERROR",
    ),
)
async def refresh(payload: RefreshRequest, request: Request, container: ContainerDep) -> TokenOut:
    # Per token, not per client: behind the site's server every person shares one address.
    fingerprint = hashlib.sha256(payload.refresh_token.encode()).hexdigest()[:16]
    enforce_rate_limit(request, container, "refresh", fingerprint)
    return _token_out(await container.sessions.refresh(payload.refresh_token))


@router.post(
    "/logout",
    status_code=204,
    summary="Log out",
    description=(
        "Revoke the session the refresh token belongs to. Needs no access token, and returns "
        "`204` whether or not the token is known, so it can be called twice."
    ),
    responses=errors(
        "VALIDATION_ERROR",
        "MALFORMED_REQUEST",
        "PAYLOAD_TOO_LARGE",
        "UNSUPPORTED_MEDIA_TYPE",
        "INTERNAL_ERROR",
    ),
)
async def logout(payload: RefreshRequest, container: ContainerDep) -> Response:
    await container.sessions.logout(payload.refresh_token)
    return Response(status_code=204)
