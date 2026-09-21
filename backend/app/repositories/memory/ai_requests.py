from dataclasses import replace
from datetime import datetime
from uuid import UUID

from app.domain.models import AiRequest
from app.repositories.memory.common import Store

# BR-409 and section 6: these statuses count towards a quota; blocked and disabled calls do not.
COUNTED = ("pending", "success", "provider_error", "invalid_output")


class MemoryAiRequestRepository:
    def __init__(self) -> None:
        self._items: dict[UUID, AiRequest] = {}
        self._store = Store()

    async def lock_quota(self) -> None:
        """Nothing to do: one event loop and no real suspension between the check and the write."""

    async def add(self, request: AiRequest) -> AiRequest:
        async with self._store.lock:
            self._items[request.id] = request
        return request

    async def get(self, request_id: UUID) -> AiRequest | None:
        return self._items.get(request_id)

    async def list_recent(self, limit: int = 100) -> list[AiRequest]:
        ordered = sorted(
            self._items.values(), key=lambda r: (r.created_at, str(r.id)), reverse=True
        )
        return ordered[:limit]

    async def update(self, request: AiRequest) -> None:
        async with self._store.lock:
            self._items[request.id] = replace(request)

    def _counted(self, since: datetime, user_id: UUID | None) -> list[AiRequest]:
        return [
            r
            for r in self._items.values()
            if r.created_at >= since
            and r.status in COUNTED
            and (user_id is None or r.user_id == user_id)
        ]

    async def count(self, *, since: datetime, user_id: UUID | None = None) -> int:
        return len(self._counted(since, user_id))

    async def oldest_at(self, *, since: datetime, user_id: UUID | None = None) -> datetime | None:
        found = self._counted(since, user_id)
        return min((r.created_at for r in found), default=None)

    async def delete_older_than(self, cutoff: datetime) -> int:
        async with self._store.lock:
            old = [r.id for r in self._items.values() if r.created_at < cutoff]
            for request_id in old:
                del self._items[request_id]
            return len(old)
