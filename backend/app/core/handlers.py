"""Central exception handlers: every error class returns the section 6 envelope (FR-224)."""

import re

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.errors import AppError, ErrorDetail, RateLimited
from app.core.responses import GENERIC_500, error_response

_HTTP_CODES: dict[int, tuple[str, str]] = {
    400: ("MALFORMED_REQUEST", "The request could not be understood."),
    401: ("UNAUTHENTICATED", "The access token is missing, invalid or expired."),
    403: ("FORBIDDEN", "You are not allowed to do this."),
    404: ("NOT_FOUND", "The resource or route was not found."),
    405: ("METHOD_NOT_ALLOWED", "This method is not supported on this path."),
    413: ("PAYLOAD_TOO_LARGE", "The request body is too large."),
    415: ("UNSUPPORTED_MEDIA_TYPE", "The content type must be application/json."),
}


async def handle_app_error(_: Request, error: Exception) -> JSONResponse:
    if not isinstance(error, AppError):
        raise error  # registered for that type only; anything else is a bug
    headers = {"Retry-After": str(error.retry_after)} if isinstance(error, RateLimited) else None
    return error_response(error.status_code, error.code, error.message, error.details, headers)


def _field(location: tuple[int | str, ...]) -> str:
    parts = [str(part) for part in location if part not in ("body", "query", "path")]
    return ".".join(parts) or "body"


async def handle_validation_error(_: Request, error: Exception) -> JSONResponse:
    if not isinstance(error, RequestValidationError):
        raise error  # registered for that type only; anything else is a bug
    problems = error.errors()
    if any(item["type"] == "json_invalid" for item in problems):
        return error_response(400, "MALFORMED_REQUEST", "The request body is not valid JSON.")
    details = [
        ErrorDetail(_field(tuple(item["loc"])), str(item["msg"]).removeprefix("Value error, "))
        for item in problems
    ]
    return error_response(422, "VALIDATION_ERROR", "One or more fields are invalid.", details)


def _allowed_methods(request: Request) -> str | None:
    """Every method the path supports, across all its routes (Starlette reports only one)."""
    table: list[tuple[re.Pattern[str], list[str]]] | None = getattr(
        request.app.state, "allow_table", None
    )
    if table is None:
        paths = request.app.openapi()["paths"]
        table = [
            (re.compile("^" + re.sub(r"\{[^}/]+\}", "[^/]+", template) + "$"), list(methods))
            for template, methods in paths.items()
        ]
        request.app.state.allow_table = table
    for pattern, methods in table:
        if pattern.match(request.url.path):
            return ", ".join(sorted({m.upper() for m in methods}))
    return None


async def handle_http_exception(request: Request, error: Exception) -> JSONResponse:
    if not isinstance(error, StarletteHTTPException):
        raise error  # registered for that type only; anything else is a bug
    code, message = _HTTP_CODES.get(error.status_code, ("INTERNAL_ERROR", GENERIC_500))
    allow = _allowed_methods(request) if error.status_code == 405 else None
    headers = {"Allow": allow} if allow else None
    return error_response(error.status_code, code, message, None, headers)


async def handle_unexpected(_: Request, __: Exception) -> JSONResponse:
    return error_response(500, "INTERNAL_ERROR", GENERIC_500)


def register_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, handle_app_error)
    app.add_exception_handler(RequestValidationError, handle_validation_error)
    app.add_exception_handler(StarletteHTTPException, handle_http_exception)
    app.add_exception_handler(Exception, handle_unexpected)
