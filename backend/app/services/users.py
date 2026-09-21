from dataclasses import dataclass, replace
from uuid import UUID

from app.core.clock import Clock, IdFactory
from app.core.errors import (
    EmailAlreadyExists,
    ErrorDetail,
    LastLead,
    NotFound,
    UserOwnsProjects,
    ValidationFailed,
)
from app.core.security import PasswordHasher
from app.domain.enums import Role, Theme
from app.domain.models import User
from app.domain.unset import UNSET, Unset
from app.repositories.base import Page, UnitOfWork, UserQuery
from app.services import transaction
from app.services.authz import Actor, require_lead, require_self_or_lead
from app.services.transaction import UowFactory


@dataclass(frozen=True)
class UserChanges:
    name: str | Unset = UNSET
    avatar_url: str | Unset | None = UNSET
    theme: Theme | Unset = UNSET
    role: Role | Unset = UNSET


async def _require_user(uow: UnitOfWork, user_id: UUID, *, for_update: bool = False) -> User:
    user = await uow.users.get(user_id, for_update=for_update)
    if user is None:
        raise NotFound("The user was not found.")
    return user


class UserService:
    def __init__(
        self, uow: UowFactory, hasher: PasswordHasher, clock: Clock, ids: IdFactory
    ) -> None:
        self._uow = uow
        self._hasher = hasher
        self._clock = clock
        self._ids = ids

    async def register(
        self,
        name: str,
        email: str,
        password: str,
        avatar_url: str | None = None,
        theme: Theme = Theme.SYSTEM,
        role: Role = Role.DEVELOPER,
    ) -> User:
        """BR-201, BR-209 and FR-202. `role` is only ever set by the seed command."""
        normalised = email.strip().lower()
        if password == email or password.lower() == normalised:
            raise ValidationFailed(
                "One or more fields are invalid.",
                [ErrorDetail("password", "Must not be the same as the email address.")],
            )
        hashed = await self._hasher.hash(password)  # slow work stays outside the transaction
        now = self._clock.now()
        user = User(
            id=self._ids.new_id(),
            name=name,
            email=normalised,
            password_hash=hashed,
            role=role,
            avatar_url=avatar_url,
            theme=theme,
            created_at=now,
            updated_at=now,
        )

        async def work(uow: UnitOfWork) -> User:
            if await uow.users.get_by_email(normalised) is not None:
                raise EmailAlreadyExists("An account with this email already exists.")
            return await uow.users.add(user)  # uq_users_email closes the race (FR-307)

        return await transaction.write(self._uow, work)

    async def list(self, query: UserQuery) -> Page[User]:
        return await transaction.read(self._uow, lambda uow: uow.users.list(query))

    async def get(self, user_id: UUID) -> User:
        return await transaction.read(self._uow, lambda uow: _require_user(uow, user_id))

    async def update(self, actor: Actor, user_id: UUID, changes: UserChanges) -> User:
        require_self_or_lead(actor, user_id)

        async def work(uow: UnitOfWork) -> User:
            target = await _require_user(uow, user_id)
            if not isinstance(changes.role, Unset):
                require_lead(actor)  # BR-209
                await _check_demotion(uow, target, changes.role)
            updated = replace(
                target,
                name=target.name if isinstance(changes.name, Unset) else changes.name,
                avatar_url=target.avatar_url
                if isinstance(changes.avatar_url, Unset)
                else changes.avatar_url,
                theme=target.theme if isinstance(changes.theme, Unset) else changes.theme,
                role=target.role if isinstance(changes.role, Unset) else changes.role,
                updated_at=self._clock.now(),
            )
            return await uow.users.update(updated)

        return await transaction.write(self._uow, work)

    async def delete(self, actor: Actor, user_id: UUID) -> None:
        require_lead(actor)

        async def work(uow: UnitOfWork) -> None:
            target = await _require_user(uow, user_id)
            if await uow.projects.count_by_owner(user_id) > 0:
                raise UserOwnsProjects("This user owns projects and cannot be deleted.")  # BR-207
            # Lock the lead rows (in id order, so deletions cannot deadlock), then count (BR-306).
            if target.role is Role.LEAD and await uow.users.count_leads(for_update=True) <= 1:
                raise LastLead("The last remaining lead cannot be deleted.")  # BR-208
            await uow.tasks.unassign_user(user_id)
            await uow.users.delete(user_id)

        await transaction.write(self._uow, work)


async def _check_demotion(uow: UnitOfWork, target: User, new_role: Role) -> None:
    demoting = target.role is Role.LEAD and new_role is not Role.LEAD
    # Lock the lead rows, then count, so two demotions cannot both see "two leads" (BR-306).
    if demoting and await uow.users.count_leads(for_update=True) <= 1:
        raise LastLead("The last remaining lead cannot be demoted.")  # BR-208
