from collections.abc import Sequence
from dataclasses import replace
from uuid import UUID

from app.domain.models import Profile
from app.repositories.memory.common import Store


class MemoryProfileRepository:
    def __init__(self) -> None:
        self._items: dict[UUID, Profile] = {}
        self._store = Store()

    async def get(self, user_id: UUID, *, for_update: bool = False) -> Profile | None:
        return self._items.get(user_id)

    async def get_many(self, user_ids: Sequence[UUID]) -> dict[UUID, Profile]:
        return {uid: self._items[uid] for uid in user_ids if uid in self._items}

    async def add(self, profile: Profile) -> Profile:
        async with self._store.lock:
            self._items[profile.user_id] = profile
        return profile

    async def add_many(self, profiles: Sequence[Profile]) -> None:
        async with self._store.lock:
            for profile in profiles:
                self._items[profile.user_id] = profile

    async def update(self, profile: Profile) -> Profile:
        """Writes every column but the skills, like the SQL repository."""
        async with self._store.lock:
            current = self._items[profile.user_id]
            self._items[profile.user_id] = replace(profile, skills=current.skills)
        return profile

    async def replace_skills(self, user_id: UUID, skills: Sequence[str]) -> None:
        async with self._store.lock:
            self._items[user_id] = replace(self._items[user_id], skills=tuple(skills))

    async def delete(self, user_id: UUID) -> None:
        """Deleting a user removes the profile (the SQL foreign key cascades)."""
        async with self._store.lock:
            self._items.pop(user_id, None)
