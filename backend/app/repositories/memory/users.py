from collections.abc import Sequence
from dataclasses import replace
from uuid import UUID

from app.domain.enums import Role
from app.domain.models import User
from app.repositories.base import Page, UserQuery
from app.repositories.memory.common import Store, matches_text, order, slice_page


class MemoryUserRepository:
    def __init__(self) -> None:
        self._items: dict[UUID, User] = {}
        self._store = Store()

    async def get(self, user_id: UUID, *, for_update: bool = False) -> User | None:
        return self._items.get(user_id)

    async def get_by_email(self, email: str, *, with_hash: bool = False) -> User | None:
        wanted = email.strip().lower()
        return next((user for user in self._items.values() if user.email == wanted), None)

    async def list(self, query: UserQuery) -> Page[User]:
        users = [
            user
            for user in self._items.values()
            if (query.role is None or user.role is query.role)
            and matches_text([user.name, user.email], query.q)
        ]
        keys = {
            "name": lambda user: user.name.lower(),
            "email": lambda user: user.email,
            "createdAt": lambda user: user.created_at,
        }
        ordered = order(users, keys[query.sort], lambda user: user.id, query.descending)
        return Page(
            slice_page(ordered, query.page, query.page_size),
            query.page,
            query.page_size,
            len(users),
        )

    async def add(self, user: User) -> User:
        async with self._store.lock:
            self._items[user.id] = replace(user)
        return user

    async def add_many(self, users: Sequence[User]) -> None:
        async with self._store.lock:
            for user in users:
                self._items[user.id] = replace(user)

    async def update(self, user: User) -> User:
        async with self._store.lock:
            self._items[user.id] = replace(user)
        return user

    async def delete(self, user_id: UUID) -> bool:
        async with self._store.lock:
            return self._items.pop(user_id, None) is not None

    async def count_leads(self, *, for_update: bool = False) -> int:
        return sum(1 for user in self._items.values() if user.role is Role.LEAD)
