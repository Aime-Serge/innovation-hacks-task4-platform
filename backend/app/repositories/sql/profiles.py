from collections.abc import Sequence
from typing import Any
from uuid import UUID

from sqlalchemy import Row, Select, delete, func, insert, literal_column, select, update
from sqlalchemy.dialects.postgresql import aggregate_order_by
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models import Profile
from app.repositories.sql import common, mappers
from app.repositories.sql.models import ProfileRow, ProfileSkillRow

_COLUMNS = tuple(ProfileRow.__table__.c)  # plain rows, so mappers read columns by name


class SqlProfileRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    @staticmethod
    def _select() -> Select[Any]:
        """One query: the profile columns and its skills, in order, as an array."""
        skills = (
            select(
                func.coalesce(
                    func.array_agg(
                        aggregate_order_by(ProfileSkillRow.name, ProfileSkillRow.sort_order)
                    ),
                    literal_column("ARRAY[]::text[]"),
                )
            )
            .where(ProfileSkillRow.user_id == ProfileRow.user_id)
            .scalar_subquery()
        )
        return select(*_COLUMNS, skills.label("skills"))

    @staticmethod
    def _build(rows: Sequence[Row[Any]]) -> dict[UUID, Profile]:
        return {row.user_id: mappers.profile_from(row, tuple(row.skills)) for row in rows}

    async def get(self, user_id: UUID, *, for_update: bool = False) -> Profile | None:
        statement = self._select().where(ProfileRow.user_id == user_id)
        if for_update:
            statement = statement.with_for_update()  # the lock PUT /me/skills serialises on
        row = (await common.run(self._session, statement, "read")).first()
        return None if row is None else self._build([row])[user_id]

    async def get_many(self, user_ids: Sequence[UUID]) -> dict[UUID, Profile]:
        if not user_ids:
            return {}
        statement = self._select().where(ProfileRow.user_id.in_(list(user_ids)))
        rows = (await common.run(self._session, statement, "read")).all()
        return self._build(rows)

    async def add(self, profile: Profile) -> Profile:
        await common.run(
            self._session, insert(ProfileRow).values(mappers.profile_values(profile)), "insert"
        )
        await self.replace_skills(profile.user_id, profile.skills)
        return profile

    async def add_many(self, profiles: Sequence[Profile]) -> None:
        await common.run_many(
            self._session, insert(ProfileRow), [mappers.profile_values(p) for p in profiles]
        )
        for profile in profiles:
            if profile.skills:
                await self.replace_skills(profile.user_id, profile.skills)

    async def update(self, profile: Profile) -> Profile:
        values = mappers.profile_values(profile)
        for immutable in ("user_id", "created_at"):
            values.pop(immutable)
        await common.run(
            self._session,
            update(ProfileRow).where(ProfileRow.user_id == profile.user_id).values(values),
            "update",
        )
        return profile

    async def replace_skills(self, user_id: UUID, skills: Sequence[str]) -> None:
        await common.run(
            self._session,
            delete(ProfileSkillRow).where(ProfileSkillRow.user_id == user_id),
            "delete",
        )
        if skills:
            rows = [
                {"user_id": user_id, "name": name, "sort_order": index}
                for index, name in enumerate(skills)
            ]
            await common.run_many(self._session, insert(ProfileSkillRow), rows)

    async def delete(self, user_id: UUID) -> None:
        """The foreign key cascades from users; this makes the intent explicit and portable."""
        await common.run(
            self._session, delete(ProfileRow).where(ProfileRow.user_id == user_id), "delete"
        )
