from datetime import datetime
from uuid import UUID

from sqlalchemy import ColumnElement, delete, func, insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models import AiRequest
from app.repositories.memory.ai_requests import COUNTED
from app.repositories.sql import common
from app.repositories.sql.models import AiRequestRow as Row

_QUOTA_LOCK = 4_242_001  # an arbitrary key that only the quota reservation uses


def _values(r: AiRequest) -> dict[str, object]:
    return {
        "id": r.id,
        "user_id": r.user_id,
        "feature": r.feature,
        "status": r.status,
        "provider": r.provider,
        "model": r.model,
        "prompt_version": r.prompt_version,
        "input_tokens": r.input_tokens,
        "output_tokens": r.output_tokens,
        "latency_ms": r.latency_ms,
        "error_code": r.error_code,
        "created_at": r.created_at,
    }


def _from(row: Row) -> AiRequest:
    return AiRequest(
        id=row.id,
        user_id=row.user_id,
        feature=row.feature,
        status=row.status,
        provider=row.provider,
        model=row.model,
        prompt_version=row.prompt_version,
        input_tokens=row.input_tokens,
        output_tokens=row.output_tokens,
        latency_ms=row.latency_ms,
        error_code=row.error_code,
        created_at=row.created_at,
    )


def _counted(since: datetime, user_id: UUID | None) -> list[ColumnElement[bool]]:
    found: list[ColumnElement[bool]] = [Row.created_at >= since, Row.status.in_(COUNTED)]
    if user_id is not None:
        found.append(Row.user_id == user_id)
    return found


class SqlAiRequestRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def lock_quota(self) -> None:
        """Serialise reservations until this transaction ends, so a burst cannot all slip under."""
        await common.run(self._session, select(func.pg_advisory_xact_lock(_QUOTA_LOCK)), "read")

    async def add(self, request: AiRequest) -> AiRequest:
        await common.run(self._session, insert(Row).values(_values(request)), "insert")
        return request

    async def get(self, request_id: UUID) -> AiRequest | None:
        row = (
            await common.run(self._session, select(Row).where(Row.id == request_id), "read")
        ).scalar_one_or_none()
        return None if row is None else _from(row)

    async def list_recent(self, limit: int = 100) -> list[AiRequest]:
        statement = select(Row).order_by(Row.created_at.desc(), Row.id.desc()).limit(limit)
        return [_from(r) for r in (await common.run(self._session, statement, "read")).scalars()]

    async def update(self, request: AiRequest) -> None:
        values = _values(request)
        for immutable in ("id", "user_id", "feature", "created_at"):
            values.pop(immutable)
        await common.run(
            self._session, update(Row).where(Row.id == request.id).values(values), "update"
        )

    async def count(self, *, since: datetime, user_id: UUID | None = None) -> int:
        statement = select(func.count()).select_from(Row).where(*_counted(since, user_id))
        return int((await common.run(self._session, statement, "read")).scalar_one())

    async def oldest_at(self, *, since: datetime, user_id: UUID | None = None) -> datetime | None:
        statement = select(func.min(Row.created_at)).where(*_counted(since, user_id))
        result: datetime | None = (await common.run(self._session, statement, "read")).scalar_one()
        return result

    async def delete_older_than(self, cutoff: datetime) -> int:
        result = await common.run(
            self._session, delete(Row).where(Row.created_at < cutoff), "delete"
        )
        return int(result.rowcount)
