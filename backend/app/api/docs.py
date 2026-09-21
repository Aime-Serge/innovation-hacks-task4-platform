"""Shared OpenAPI documentation: every error response with an example (FR-228, NFR-219)."""

from typing import Any

from app.schemas.common import ErrorResponse

CATALOGUE: dict[str, tuple[int, str]] = {
    "MALFORMED_REQUEST": (400, "The request body is not valid JSON."),
    "UNAUTHENTICATED": (401, "The access token is missing, invalid or expired."),
    "INVALID_CREDENTIALS": (401, "The email or password is incorrect."),
    "FORBIDDEN": (403, "Only the project owner or a lead may do this."),
    "NOT_FOUND": (404, "The resource was not found."),
    "METHOD_NOT_ALLOWED": (405, "This method is not supported on this path."),
    "EMAIL_ALREADY_EXISTS": (409, "An account with this email already exists."),
    "INVALID_STATUS_TRANSITION": (409, "A task cannot move from todo to done."),
    "PROJECT_NOT_EMPTY": (409, "The project still has tasks and cannot be deleted."),
    "PROJECT_CLOSED": (409, "A completed project accepts no new tasks."),
    "USER_OWNS_PROJECTS": (409, "This user owns projects and cannot be deleted."),
    "LAST_LEAD": (409, "The last remaining lead cannot be deleted."),
    "PAYLOAD_TOO_LARGE": (413, "The request body is too large."),
    "UNSUPPORTED_MEDIA_TYPE": (415, "The content type must be application/json."),
    "VALIDATION_ERROR": (422, "One or more fields are invalid."),
    "RATE_LIMITED": (429, "Too many attempts. Try again later."),
    "SERVICE_UNAVAILABLE": (503, "A dependency is not ready."),
    "INTERNAL_ERROR": (500, "Something went wrong on our side."),
}

_TITLES = {
    400: "Malformed request",
    401: "Not authenticated",
    403: "Forbidden",
    404: "Not found",
    405: "Method not allowed",
    409: "Conflict with the current state",
    413: "Payload too large",
    415: "Unsupported media type",
    422: "Validation error",
    429: "Rate limited",
    500: "Unexpected error",
    503: "Service unavailable",
}


def errors(*codes: str) -> dict[int | str, dict[str, Any]]:
    """Build the `responses` mapping for a route, one entry per HTTP status."""
    grouped: dict[int, dict[str, dict[str, Any]]] = {}
    for code in codes:
        status, message = CATALOGUE[code]
        error: dict[str, Any] = {
            "code": code,
            "message": message,
            "requestId": "8f0c2e4a-3b1d-4f6e-9a57-2d7c1e9b5a10",
        }
        if code == "VALIDATION_ERROR":
            error["details"] = [
                {"field": "title", "message": "Must be between 1 and 120 characters."}
            ]
        if code == "INVALID_STATUS_TRANSITION":
            error["details"] = [{"field": "allowedStatuses", "message": "in_progress"}]
        grouped.setdefault(status, {})[code] = {"summary": code, "value": {"error": error}}
    return {
        status: {
            "model": ErrorResponse,
            "description": _TITLES[status],
            "content": {"application/json": {"examples": examples}},
        }
        for status, examples in grouped.items()
    }
