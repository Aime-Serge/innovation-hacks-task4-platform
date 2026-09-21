from datetime import datetime
from uuid import UUID

from sqlalchemy import delete, insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models import RefreshToken
from app.repositories.sql import common
from app.repositories.sql.models import RefreshTokenRow as Row

COLUMNS = (
    Row.id,
    Row.user_id,
    Row.family_id,
    Row.token_hash,
    Row.expires_at,
    Row.used_at,
    Row.revoked_at,
    Row.created_at,
)


class SqlRefreshTokenRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, token: RefreshToken) -> RefreshToken:
        values = {
            "id": token.id,
            "user_id": token.user_id,
            "family_id": token.family_id,
            "token_hash": token.token_hash,
            "expires_at": token.expires_at,
            "used_at": token.used_at,
            "revoked_at": token.revoked_at,
            "created_at": token.created_at,
        }
        await common.run(self._session, insert(Row).values(values), "insert")
        return token

    async def get_by_hash(
        self, token_hash: str, *, for_update: bool = False
    ) -> RefreshToken | None:
        statement = select(*COLUMNS).where(Row.token_hash == token_hash)
        if for_update:
            statement = statement.with_for_update()  # two refreshes of one token cannot both win
        row = (await common.run(self._session, statement, "read")).first()
        if row is None:
            return None
        return RefreshToken(
            id=row.id,
            user_id=row.user_id,
            family_id=row.family_id,
            token_hash=row.token_hash,
            expires_at=row.expires_at,
            used_at=row.used_at,
            revoked_at=row.revoked_at,
            created_at=row.created_at,
        )

    async def mark_used(self, token_id: UUID, at: datetime) -> None:
        await common.run(
            self._session, update(Row).where(Row.id == token_id).values(used_at=at), "update"
        )

    async def revoke_family(self, family_id: UUID, at: datetime) -> int:
        result = await common.run(
            self._session,
            update(Row)
            .where(Row.family_id == family_id, Row.revoked_at.is_(None))
            .values(revoked_at=at),
            "update",
        )
        return int(result.rowcount)

    async def delete_expired(self, before: datetime) -> int:
        result = await common.run(
            self._session, delete(Row).where(Row.expires_at < before), "delete"
        )
        return int(result.rowcount)
