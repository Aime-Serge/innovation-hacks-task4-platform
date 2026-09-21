from dataclasses import replace
from datetime import datetime
from uuid import UUID

from app.core.clock import Clock, IdFactory
from app.domain.enums import ActivityType
from app.domain.models import Activity
from app.repositories.base import ActivityQuery, Page, UnitOfWork
from app.services import transaction
from app.services.authz import Actor
from app.services.transaction import UowFactory
from app.services.visibility import read_scope


class ActivityService:
    def __init__(self, uow: UowFactory, clock: Clock, ids: IdFactory) -> None:
        self._uow = uow
        self._clock = clock
        self._ids = ids

    async def record(
        self,
        uow: UnitOfWork,
        actor_id: UUID,
        project_id: UUID,
        kind: ActivityType,
        task_id: UUID | None = None,
    ) -> Activity:
        """Written inside the caller's transaction, so the change and its feed entry are one."""
        now: datetime = self._clock.now()
        return await uow.activity.add(
            Activity(self._ids.new_id(), actor_id, project_id, task_id, kind, now)
        )

    async def list(self, actor: Actor, query: ActivityQuery) -> Page[Activity]:
        async def work(uow: UnitOfWork) -> Page[Activity]:
            return await uow.activity.list(replace(query, scope=await read_scope(uow, actor)))

        return await transaction.read(self._uow, work)
