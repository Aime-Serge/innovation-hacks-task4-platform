"""The single translator from database failures to the existing API error codes (section 7).

It is keyed by constraint name and operation, never by parsing message text (ADR-305). Nothing that
reaches a client contains SQL, a table name or driver wording; unknown failures propagate and become
the generic 500.
"""

import logging
from typing import Literal

from sqlalchemy.exc import DBAPIError, InterfaceError
from sqlalchemy.exc import TimeoutError as PoolTimeoutError

from app.core.errors import (
    EmailAlreadyExists,
    ErrorDetail,
    ProjectNotEmpty,
    ServiceUnavailable,
    UserOwnsProjects,
    ValidationFailed,
)
from app.core.logging import LOGGER_NAME
from app.repositories.base import TransientStoreError

Operation = Literal["insert", "update", "delete", "read"]

_log = logging.getLogger(LOGGER_NAME)

UNIQUE_VIOLATION = "23505"
FOREIGN_KEY_VIOLATION = "23503"
CHECK_VIOLATION = "23514"
UNSTORABLE_TEXT = {
    "22021",
    "22P05",
}  # a NUL or an invalid byte sequence: text PostgreSQL cannot hold
TRANSIENT = {"40P01", "40001", "55P03", "57014"}  # deadlock, serialization, lock/statement timeout
UNAVAILABLE = ("08", "53", "57P")  # connection, resources, operator shutdown

_INVALID = "One or more fields are invalid."

# constraint -> (field, message) for a reference that does not exist
_MISSING_PARENT = {
    "fk_tasks_project_id_projects": ("projectId", "The project does not exist."),
    "fk_tasks_assignee_id_users": ("assigneeId", "The assignee does not exist."),
}
# rule name in `ck_<table>_<rule>` -> the API field that most likely broke it
_CHECK_FIELD = {
    "name_length": "name",
    "email_format": "email",
    "avatar_url": "avatarUrl",
    "title_length": "title",
    "description_length": "description",
    "status": "status",
    "priority": "priority",
}


def _cause(error: BaseException) -> object:
    orig = getattr(error, "orig", None)
    return getattr(orig, "__cause__", None) or orig


def sqlstate(error: BaseException) -> str | None:
    value = getattr(_cause(error), "sqlstate", None)
    return value if isinstance(value, str) else None


def constraint(error: BaseException) -> str | None:
    value = getattr(_cause(error), "constraint_name", None)
    return value if isinstance(value, str) else None


def _unavailable(error: BaseException) -> bool:
    """A failure that means the database cannot be reached or is shutting down."""
    if isinstance(error, PoolTimeoutError | InterfaceError | OSError | TimeoutError):
        return True
    if not isinstance(error, DBAPIError):
        return False
    state = sqlstate(error)
    return error.connection_invalidated or (state is not None and state.startswith(UNAVAILABLE))


def translate(error: BaseException, operation: Operation) -> Exception | None:
    """Return the API-level error for a database failure, or None when it is not one we map."""
    if _unavailable(error):
        return ServiceUnavailable("A dependency is not ready.")
    if not isinstance(error, DBAPIError):
        return None
    state, name = sqlstate(error), constraint(error)
    if state in TRANSIENT:
        return TransientStoreError(state)
    if state == UNIQUE_VIOLATION and name == "uq_users_email":
        return EmailAlreadyExists("An account with this email already exists.")
    if state == FOREIGN_KEY_VIOLATION:
        return _foreign_key(name, operation)
    if state == CHECK_VIOLATION:
        return _check(name)
    if state in UNSTORABLE_TEXT:
        return ValidationFailed(
            _INVALID, [ErrorDetail("body", "The text contains a character that cannot be stored.")]
        )
    return None


def _foreign_key(name: str | None, operation: Operation) -> Exception | None:
    if operation == "delete":
        if name == "fk_tasks_project_id_projects":
            return ProjectNotEmpty("The project still has tasks and cannot be deleted.")
        if name == "fk_projects_owner_id_users":
            return UserOwnsProjects("This user owns projects and cannot be deleted.")
        return None
    if name in _MISSING_PARENT:
        field, message = _MISSING_PARENT[name]
        return ValidationFailed(_INVALID, [ErrorDetail(field, message)])
    return None


def _check(name: str | None) -> Exception:
    # Application validation should have caught this: it is a defect, so it is logged (section 7).
    _log.error("database check constraint rejected a write", extra={"errorType": name or "check"})
    rule = (name or "").split("_", 2)[-1]
    field = _CHECK_FIELD.get(rule, "body")
    return ValidationFailed(_INVALID, [ErrorDetail(field, "The value is not allowed.")])
