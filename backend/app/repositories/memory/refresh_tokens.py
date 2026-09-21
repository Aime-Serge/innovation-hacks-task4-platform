from dataclasses import replace
from datetime import datetime
from uuid import UUID

from app.domain.models import RefreshToken
from app.repositories.memory.common import Store


class MemoryRefreshTokenRepository:
    def __init__(self) -> None:
        self._items: dict[UUID, RefreshToken] = {}
        self._store = Store()

    async def add(self, token: RefreshToken) -> RefreshToken:
        async with self._store.lock:
            self._items[token.id] = token
        return token

    async def get_by_hash(
        self, token_hash: str, *, for_update: bool = False
    ) -> RefreshToken | None:
        return next((t for t in self._items.values() if t.token_hash == token_hash), None)

    async def mark_used(self, token_id: UUID, at: datetime) -> None:
        async with self._store.lock:
            self._items[token_id] = replace(self._items[token_id], used_at=at)

    async def revoke_family(self, family_id: UUID, at: datetime) -> int:
        async with self._store.lock:
            family = [t for t in self._items.values() if t.family_id == family_id]
            for token in family:
                if token.revoked_at is None:
                    self._items[token.id] = replace(token, revoked_at=at)
            return len(family)

    async def revoke_user_except(
        self, user_id: UUID, keep_family: UUID | None, at: datetime
    ) -> int:
        async with self._store.lock:
            mine = [
                t
                for t in self._items.values()
                if t.user_id == user_id and t.family_id != keep_family and t.revoked_at is None
            ]
            for token in mine:
                self._items[token.id] = replace(token, revoked_at=at)
            return len(mine)

    async def delete_expired(self, before: datetime) -> int:
        async with self._store.lock:
            old = [t.id for t in self._items.values() if t.expires_at < before]
            for token_id in old:
                del self._items[token_id]
            return len(old)
