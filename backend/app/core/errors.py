"""One AppError hierarchy; only the central handlers turn these into responses (ADR-206)."""

from dataclasses import dataclass
from typing import ClassVar


@dataclass(frozen=True)
class ErrorDetail:
    field: str
    message: str


class AppError(Exception):
    code: ClassVar[str] = "INTERNAL_ERROR"
    status_code: ClassVar[int] = 500

    def __init__(self, message: str, details: list[ErrorDetail] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details


class Unauthenticated(AppError):
    code = "UNAUTHENTICATED"
    status_code = 401


class InvalidCredentials(AppError):
    code = "INVALID_CREDENTIALS"
    status_code = 401


class Forbidden(AppError):
    code = "FORBIDDEN"
    status_code = 403


class NotFound(AppError):
    code = "NOT_FOUND"
    status_code = 404


class EmailAlreadyExists(AppError):
    code = "EMAIL_ALREADY_EXISTS"
    status_code = 409


class InvalidStatusTransition(AppError):
    code = "INVALID_STATUS_TRANSITION"
    status_code = 409


class ProjectNotEmpty(AppError):
    code = "PROJECT_NOT_EMPTY"
    status_code = 409


class ProjectClosed(AppError):
    code = "PROJECT_CLOSED"
    status_code = 409


class UserOwnsProjects(AppError):
    code = "USER_OWNS_PROJECTS"
    status_code = 409


class LastLead(AppError):
    code = "LAST_LEAD"
    status_code = 409


class ValidationFailed(AppError):
    """A rule the schema cannot express, such as an unknown project id (422)."""

    code = "VALIDATION_ERROR"
    status_code = 422


class RateLimited(AppError):
    code = "RATE_LIMITED"
    status_code = 429

    def __init__(self, message: str, retry_after: int) -> None:
        super().__init__(message)
        self.retry_after = retry_after


class ServiceUnavailable(AppError):
    code = "SERVICE_UNAVAILABLE"
    status_code = 503
