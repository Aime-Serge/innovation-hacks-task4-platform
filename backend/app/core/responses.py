"""The one error envelope (FR-224). Built here and nowhere else."""

from collections.abc import Mapping

from fastapi.responses import JSONResponse

from app.core.errors import ErrorDetail
from app.core.logging import request_id_var

GENERIC_500 = "Something went wrong on our side. Quote the request id if you contact support."


def error_response(
    status_code: int,
    code: str,
    message: str,
    details: list[ErrorDetail] | None = None,
    headers: Mapping[str, str] | None = None,
) -> JSONResponse:
    error: dict[str, object] = {"code": code, "message": message}
    if details is not None:
        error["details"] = [{"field": item.field, "message": item.message} for item in details]
    error["requestId"] = request_id_var.get()
    return JSONResponse({"error": error}, status_code=status_code, headers=dict(headers or {}))
