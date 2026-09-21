"""Refresh-token sessions: login, rotation, reuse detection and logout (BR-404, FR-403, FR-406).

A refresh token is random, used once and replaced on every refresh. Only its SHA-256 hash is
stored. Presenting one that was already used revokes its whole family, because either the person
or a thief has a copy (TH-410). Logout revokes the family and never says whether the token was
known.
"""

import hashlib
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta
from uuid import UUID

from app.core.clock import Clock, IdFactory
from app.core.errors import RefreshTokenInvalid
from app.core.security import TokenCodec
from app.domain.models import RefreshToken, User
from app.repositories.base import UnitOfWork
from app.services import transaction
from app.services.auth import AuthService
from app.services.transaction import UowFactory

_INVALID = "The refresh token is expired, unknown, revoked or already used."
_PURGE_AFTER = timedelta(days=30)  # BR-413


@dataclass(frozen=True)
class SessionTokens:
    access_token: str
    expires_in: int
    refresh_token: str
    refresh_expires_in: int


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


class SessionService:
    def __init__(
        self,
        uow: UowFactory,
        auth: AuthService,
        tokens: TokenCodec,
        clock: Clock,
        ids: IdFactory,
        refresh_ttl_seconds: int,
    ) -> None:
        self._uow = uow
        self._auth = auth
        self._tokens = tokens
        self._clock = clock
        self._ids = ids
        self._ttl = refresh_ttl_seconds

    def _new(self, user_id: UUID, family_id: UUID, now: datetime) -> tuple[str, RefreshToken]:
        raw = secrets.token_urlsafe(48)
        row = RefreshToken(
            id=self._ids.new_id(),
            user_id=user_id,
            family_id=family_id,
            token_hash=hash_token(raw),
            expires_at=now + timedelta(seconds=self._ttl),
            used_at=None,
            revoked_at=None,
            created_at=now,
        )
        return raw, row

    def _pair(self, user: User, raw: str, now: datetime) -> SessionTokens:
        access = self._tokens.issue(user.id, user.role.value, now)
        return SessionTokens(access.access_token, access.expires_in, raw, self._ttl)

    async def login(self, email: str, password: str) -> SessionTokens:
        user = await self._auth.verify_credentials(email, password)
        now = self._clock.now()
        raw, row = self._new(user.id, self._ids.new_id(), now)

        async def work(uow: UnitOfWork) -> None:
            await uow.refresh_tokens.add(row)

        await transaction.write(self._uow, work)
        return self._pair(user, raw, now)

    async def refresh(self, presented: str) -> SessionTokens:
        now = self._clock.now()
        digest = hash_token(presented)

        async def work(uow: UnitOfWork) -> tuple[str, User | None, str | None]:
            row = await uow.refresh_tokens.get_by_hash(digest, for_update=True)
            if row is None or row.revoked_at is not None or row.expires_at <= now:
                return "invalid", None, None
            if row.used_at is not None:
                # Reuse: revoke the whole family, and commit that even though we then refuse.
                await uow.refresh_tokens.revoke_family(row.family_id, now)
                return "reuse", None, None
            user = await uow.users.get(row.user_id)
            if user is None:
                return "invalid", None, None
            raw, fresh = self._new(user.id, row.family_id, now)
            await uow.refresh_tokens.mark_used(row.id, now)
            await uow.refresh_tokens.add(fresh)
            return "ok", user, raw

        outcome, user, raw = await transaction.write(self._uow, work)
        if outcome != "ok" or user is None or raw is None:
            raise RefreshTokenInvalid(_INVALID)
        return self._pair(user, raw, now)

    async def logout(self, presented: str) -> None:
        """Idempotent: an unknown or already revoked token is the same quiet success."""
        now = self._clock.now()
        digest = hash_token(presented)

        async def work(uow: UnitOfWork) -> None:
            row = await uow.refresh_tokens.get_by_hash(digest, for_update=True)
            if row is not None:
                await uow.refresh_tokens.revoke_family(row.family_id, now)

        await transaction.write(self._uow, work)

    async def purge(self) -> int:
        """BR-413: refresh tokens expired for more than 30 days are deleted."""
        cutoff = self._clock.now() - _PURGE_AFTER

        async def work(uow: UnitOfWork) -> int:
            return await uow.refresh_tokens.delete_expired(cutoff)

        return await transaction.write(self._uow, work)
