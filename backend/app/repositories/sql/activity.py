from collections.abc import Sequence

from sqlalchemy import insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models import Activity
from app.domain.queries import ActivityQuery, Page
from app.repositories.sql import common, mappers
from app.repositories.sql.models import ActivityRow

COLUMNS = (
    ActivityRow.id,
    ActivityRow.actor_id,
    ActivityRow.project_id,
    ActivityRow.task_id,
    ActivityRow.type,
    ActivityRow.at,
)


class SqlActivityRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, activity: Activity) -> Activity:
        await common.run(
            self._session, insert(ActivityRow).values(mappers.activity_values(activity)), "insert"
        )
        return activity

    async def add_many(self, items: Sequence[Activity]) -> None:
        await common.run_many(
            self._session, insert(ActivityRow), [mappers.activity_values(a) for a in items]
        )

    async def list(self, query: ActivityQuery) -> Page[Activity]:
        """Newest first, ties broken by id descending, as the (at DESC, id DESC) index is."""
        return await common.page_of(
            self._session,
            select(*COLUMNS).order_by(ActivityRow.at.desc(), ActivityRow.id.desc()),
            select(ActivityRow.id),
            query.page,
            query.page_size,
            mappers.activity_from,
        )
