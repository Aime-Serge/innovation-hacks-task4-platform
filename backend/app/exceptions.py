import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("app.errors")


class AppError(Exception):
    """Base application error — every deliberate 4xx raised by route/repo
    code should be one of these (or a subclass) so the global handler can
    render it consistently."""

    def __init__(self, status_code: int, code: str, message: str, details: object | None = None):
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details
        super().__init__(message)


class NotFoundError(AppError):
    def __init__(self, message: str, details: object | None = None):
        super().__init__(status.HTTP_404_NOT_FOUND, "not_found", message, details)


class ConflictError(AppError):
    def __init__(self, message: str, details: object | None = None):
        super().__init__(status.HTTP_409_CONFLICT, "conflict", message, details)


def _error_body(code: str, message: str, details: object | None = None) -> dict:
    return {"error": {"code": code, "message": message, "details": details}}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_body(exc.code, exc.message, exc.details),
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        """Every bare `raise HTTPException(...)` in the codebase (login's
        401, self-only 403s, avatar upload's 413/415, reset-password's
        400, and anything FastAPI itself raises) was falling through to
        Starlette's default {"detail": "..."} shape instead of this
        app's {"error": {code, message, details}} contract — undetected
        until a test finally asserted on the body shape, not just the
        status code. This normalizes all of them in one place instead
        of converting every call site to a bespoke AppError subclass."""
        code = {
            status.HTTP_400_BAD_REQUEST: "bad_request",
            status.HTTP_401_UNAUTHORIZED: "unauthorized",
            status.HTTP_403_FORBIDDEN: "forbidden",
            status.HTTP_404_NOT_FOUND: "not_found",
            status.HTTP_405_METHOD_NOT_ALLOWED: "method_not_allowed",
            status.HTTP_409_CONFLICT: "conflict",
            status.HTTP_413_CONTENT_TOO_LARGE: "payload_too_large",
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE: "unsupported_media_type",
        }.get(exc.status_code, "http_error")
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_body(code, str(exc.detail), None),
            headers=exc.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            content=_error_body(
                "validation_error", "Request failed validation.", exc.errors()
            ),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_error_body(
                "internal_server_error", "An unexpected error occurred.", None
            ),
        )
