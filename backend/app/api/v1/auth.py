from fastapi import APIRouter, Request

from app.api.deps import ContainerDep, CurrentUser, enforce_rate_limit
from app.api.docs import errors
from app.schemas.misc import LoginRequest, TokenOut
from app.schemas.users import UserOut

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
    issued = await container.auth.login(payload.email, payload.password)
    return TokenOut(access_token=issued.access_token, expires_in=issued.expires_in)


@router.get(
    "/me",
    response_model=UserOut,
    summary="Current user",
    description="Return the user the token belongs to. Useful to check a token is still valid.",
    responses=errors("UNAUTHENTICATED", "INTERNAL_ERROR"),
)
async def me(user: CurrentUser) -> UserOut:
    return UserOut.of(user)
