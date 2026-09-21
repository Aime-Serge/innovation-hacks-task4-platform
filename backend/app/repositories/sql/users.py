from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import ColumnElement, delete, func, insert, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models import User
from app.domain.queries import Page, UserQuery
from app.repositories.sql import common, mappers
from app.repositories.sql.models import UserRow

# Every read but the login lookup names these columns, so the hash is never selected (NFR-318).
PUBLIC = (
    UserRow.id,
    UserRow.name,
    UserRow.email,
    UserRow.role,
    UserRow.avatar_url,
    UserRow.theme,
    UserRow.created_at,
    UserRow.updated_at,
)


class SqlUserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, user_id: UUID, *, for_update: bool = False) -> User | None:
        statement = select(*PUBLIC).where(UserRow.id == user_id)
        if for_update:
            statement = statement.with_for_update()
        row = (await common.run(self._session, statement, "read")).first()
        return None if row is None else mappers.user_from(row)

    async def get_by_email(self, email: str, *, with_hash: bool = False) -> User | None:
        """`with_hash=True` is the login lookup, the only query that selects `password_hash`."""
        columns = (*PUBLIC, UserRow.password_hash) if with_hash else PUBLIC
        statement = select(*columns).where(UserRow.email == email.strip().lower())
        row = (await common.run(self._session, statement, "read")).first()
        if row is None:
            return None
        return mappers.user_from(row, row.password_hash if with_hash else mappers.NO_HASH)

    async def list(self, query: UserQuery) -> Page[User]:
        conditions: list[ColumnElement[bool]] = []
        if query.role is not None:
            conditions.append(UserRow.role == query.role.value)
        pattern = common.like_pattern(query.q)
        if pattern is not None:
            conditions.append(
                or_(
                    UserRow.name.ilike(pattern, escape="\\"),
                    UserRow.email.ilike(pattern, escape="\\"),
                )
            )
        sort = {
            "name": common.codepoint_order(func.lower(UserRow.name)),
            "email": common.codepoint_order(UserRow.email),
            "createdAt": UserRow.created_at,
        }[query.sort]
        statement = (
            select(*PUBLIC)
            .where(*conditions)
            .order_by(sort.desc() if query.descending else sort.asc(), UserRow.id.asc())
        )
        return await common.page_of(
            self._session,
            statement,
            select(UserRow.id).where(*conditions),
            query.page,
            query.page_size,
            mappers.user_from,
            window=True,
        )

    async def add(self, user: User) -> User:
        await common.run(self._session, insert(UserRow).values(mappers.user_values(user)), "insert")
        return user

    async def add_many(self, users: Sequence[User]) -> None:
        await common.run_many(
            self._session, insert(UserRow), [mappers.user_values(user) for user in users]
        )

    async def update(self, user: User) -> User:
        """Never writes the hash: there is no password change in the API (NFR-318)."""
        values = mappers.user_values(user)
        for immutable in ("id", "password_hash", "email", "created_at"):
            values.pop(immutable)
        await common.run(
            self._session, update(UserRow).where(UserRow.id == user.id).values(values), "update"
        )
        return user

    async def delete(self, user_id: UUID) -> bool:
        result = await common.run(
            self._session, delete(UserRow).where(UserRow.id == user_id), "delete"
        )
        return bool(result.rowcount)

    async def count_leads(self, *, for_update: bool = False) -> int:
        if for_update:
            # Locked in id order, so two concurrent changes cannot deadlock on these rows (BR-306).
            locked = select(UserRow.id).where(UserRow.role == "lead").order_by(UserRow.id)
            rows = (await common.run(self._session, locked.with_for_update(), "read")).all()
            return len(rows)
        counted = select(func.count()).select_from(UserRow).where(UserRow.role == "lead")
        return int((await common.run(self._session, counted, "read")).scalar_one())
