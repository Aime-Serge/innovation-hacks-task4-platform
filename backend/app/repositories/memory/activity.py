from collections.abc import Sequence
from uuid import UUID

from app.domain.models import Activity
from app.repositories.base import ActivityQuery, Page
from app.repositories.memory.common import Store, slice_page


class MemoryActivityRepository:
    def __init__(self) -> None:
        self._items: dict[UUID, Activity] = {}
        self._store = Store()

    async def add(self, activity: Activity) -> Activity:
        async with self._store.lock:
            self._items[activity.id] = activity
        return activity

    async def add_many(self, items: Sequence[Activity]) -> None:
        async with self._store.lock:
            for item in items:
                self._items[item.id] = item

    async def list(self, query: ActivityQuery) -> Page[Activity]:
        """Newest first."""
        items = [
            item
            for item in self._items.values()
            if query.scope is None or query.scope.allows(item.project_id)
        ]
        # Newest first; ties break by id descending, matching the (at DESC, id DESC) index.
        ordered = sorted(items, key=lambda item: (item.at, str(item.id)), reverse=True)
        return Page(
            slice_page(ordered, query.page, query.page_size),
            query.page,
            query.page_size,
            len(items),
        )
