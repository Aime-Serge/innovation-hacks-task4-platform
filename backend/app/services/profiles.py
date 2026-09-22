"""The signed-in person's profile, preferences, privacy, password and account (MF-06 to MF-17)."""

from dataclasses import dataclass, replace
from uuid import UUID

from app.core.clock import Clock
from app.core.errors import (
    CurrentPasswordWrong,
    ErrorDetail,
    LastLead,
    NotFound,
    UserOwnsProjects,
    ValidationFailed,
)
from app.core.security import PasswordHasher
from app.domain import profile_rules
from app.domain.enums import Discipline, EmploymentStatus, Role, Seniority, Theme
from app.domain.models import Profile, ProfileStats, User
from app.domain.unset import UNSET, Unset
from app.repositories.base import UnitOfWork
from app.services import transaction
from app.services.session_service import hash_token
from app.services.transaction import UowFactory
from app.services.users import work_detail_problems


@dataclass(frozen=True)
class ProfileChanges:
    """What PATCH /me/profile changes. UNSET means "leave as it is"; None clears an optional."""

    given_name: str | Unset = UNSET
    family_name: str | Unset = UNSET
    discipline: Discipline | Unset = UNSET
    seniority: Seniority | Unset = UNSET
    employment_status: EmploymentStatus | Unset = UNSET
    company_name: str | Unset | None = UNSET
    job_title: str | Unset | None = UNSET
    country: str | Unset = UNSET
    city: str | Unset | None = UNSET
    time_zone: str | Unset = UNSET
    headline: str | Unset | None = UNSET
    about: str | Unset = UNSET
    github: str | Unset | None = UNSET
    linkedin: str | Unset | None = UNSET
    website: str | Unset | None = UNSET


def _pick[T](current: T, change: T | Unset) -> T:
    return current if isinstance(change, Unset) else change


async def _load(uow: UnitOfWork, user_id: UUID, *, lock: bool = False) -> tuple[User, Profile]:
    user = await uow.users.get(user_id, for_update=lock)
    profile = await uow.profiles.get(user_id, for_update=lock)
    if user is None or profile is None:
        raise NotFound("The profile was not found.")
    return user, profile


class ProfileService:
    def __init__(self, uow: UowFactory, hasher: PasswordHasher, clock: Clock) -> None:
        self._uow = uow
        self._hasher = hasher
        self._clock = clock

    async def me(self, user_id: UUID) -> tuple[User, Profile, ProfileStats]:
        async def work(uow: UnitOfWork) -> tuple[User, Profile, ProfileStats]:
            user, profile = await _load(uow, user_id)
            done, open_ = await uow.tasks.assigned_counts(user_id)
            owned = await uow.projects.count_by_owner(user_id)
            return user, profile, ProfileStats(owned, done, open_)

        return await transaction.read(self._uow, work)

    async def update_profile(self, user_id: UUID, changes: ProfileChanges) -> None:
        now = self._clock.now()

        async def work(uow: UnitOfWork) -> None:
            user, profile = await _load(uow, user_id, lock=True)
            given = _pick(user.given_name, changes.given_name)
            family = _pick(user.family_name, changes.family_name)
            status = _pick(profile.employment_status, changes.employment_status)
            company = _pick(profile.company_name, changes.company_name)
            title = _pick(profile.job_title, changes.job_title)
            problems: list[ErrorDetail] = []
            if profile_rules.needs_work_details(status):
                problems += work_detail_problems("", company, title)
            if given and family:
                if len(profile_rules.compose_name(given, family)) > profile_rules.MAX_DISPLAY_NAME:
                    problems.append(
                        ErrorDetail(
                            "familyName",
                            "Given and family name together may have at most 79 characters.",
                        )
                    )
            elif not isinstance(changes.given_name, Unset) or not isinstance(
                changes.family_name, Unset
            ):
                problems.append(ErrorDetail("familyName", "Enter both a given and a family name."))
            if problems:
                raise ValidationFailed("One or more fields are invalid.", problems)
            if given and family:
                user = replace(
                    user,
                    given_name=given,
                    family_name=family,
                    name=profile_rules.compose_name(given, family),
                    updated_at=now,
                )
                await uow.users.update(user)
            await uow.profiles.update(
                replace(
                    profile,
                    discipline=_pick(profile.discipline, changes.discipline),
                    seniority=_pick(profile.seniority, changes.seniority),
                    employment_status=status,
                    company_name=company,
                    job_title=title,
                    country_code=_pick(profile.country_code, changes.country),
                    city=_pick(profile.city, changes.city),
                    time_zone=_pick(profile.time_zone, changes.time_zone),
                    headline=_pick(profile.headline, changes.headline),
                    about=_pick(profile.about, changes.about),
                    github_url=_pick(profile.github_url, changes.github),
                    linkedin_url=_pick(profile.linkedin_url, changes.linkedin),
                    website_url=_pick(profile.website_url, changes.website),
                    updated_at=now,
                )
            )

        await transaction.write(self._uow, work)

    async def replace_skills(self, user_id: UUID, skills: list[str]) -> None:
        """MB-05: the profile row is locked, so concurrent replacements run one after another."""

        async def work(uow: UnitOfWork) -> None:
            profile = await uow.profiles.get(user_id, for_update=True)
            if profile is None:
                raise NotFound("The profile was not found.")
            await uow.profiles.replace_skills(user_id, skills)
            await uow.profiles.update(replace(profile, updated_at=self._clock.now()))

        await transaction.write(self._uow, work)

    async def set_preferences(self, user_id: UUID, theme: Theme, time_zone: str) -> None:
        now = self._clock.now()

        async def work(uow: UnitOfWork) -> None:
            user, profile = await _load(uow, user_id, lock=True)
            await uow.users.update(replace(user, theme=theme, updated_at=now))
            await uow.profiles.update(replace(profile, time_zone=time_zone, updated_at=now))

        await transaction.write(self._uow, work)

    async def set_privacy(self, user_id: UUID, show: bool) -> None:
        async def work(uow: UnitOfWork) -> None:
            profile = await uow.profiles.get(user_id, for_update=True)
            if profile is None:
                raise NotFound("The profile was not found.")
            await uow.profiles.update(
                replace(profile, show_professional_details=show, updated_at=self._clock.now())
            )

        await transaction.write(self._uow, work)

    async def _verify(self, user_id: UUID, password: str) -> User:
        """A wrong current password is 403, so the client keeps the session (pack section 5)."""
        found = await transaction.read(self._uow, lambda uow: uow.users.get(user_id))
        if found is None:
            raise NotFound("The user was not found.")
        with_hash = await transaction.read(
            self._uow, lambda uow: uow.users.get_by_email(found.email, with_hash=True)
        )
        if with_hash is None or not await self._hasher.verify(with_hash.password_hash, password):
            raise CurrentPasswordWrong("The current password is incorrect.")
        return with_hash

    async def change_password(
        self, user_id: UUID, current: str, new: str, keep_refresh_token: str | None
    ) -> None:
        """MF-13: check the current one, apply the rules, end every session but the one kept."""
        user = await self._verify(user_id, current)
        names = {user.email, user.name, user.given_name or "", user.family_name or ""}
        if new == current:
            raise ValidationFailed(
                "One or more fields are invalid.",
                [ErrorDetail("newPassword", "Choose a password different from the current one.")],
            )
        if new.strip().lower() in {name.lower() for name in names if name}:
            raise ValidationFailed(
                "One or more fields are invalid.",
                [ErrorDetail("newPassword", "Must not be the same as the email address or name.")],
            )
        hashed = await self._hasher.hash(new)
        now = self._clock.now()
        digest = hash_token(keep_refresh_token) if keep_refresh_token else None

        async def work(uow: UnitOfWork) -> None:
            keep = None
            if digest is not None:
                row = await uow.refresh_tokens.get_by_hash(digest)
                if row is not None and row.user_id == user_id:
                    keep = row.family_id  # GAP-02: only the caller's own session survives
            await uow.users.set_password_hash(user_id, hashed, now)
            await uow.refresh_tokens.revoke_user_except(user_id, keep, now)

        await transaction.write(self._uow, work)

    async def revoke_sessions(self, user_id: UUID) -> None:
        """MF-14: every refresh-token family of the person, including this one."""
        now = self._clock.now()

        async def work(uow: UnitOfWork) -> None:
            await uow.refresh_tokens.revoke_user_except(user_id, None, now)

        await transaction.write(self._uow, work)

    async def delete_account(self, user_id: UUID, password: str) -> None:
        """MF-17: password required; owned projects block it; tasks are unassigned (Task 3)."""
        user = await self._verify(user_id, password)

        async def work(uow: UnitOfWork) -> None:
            if await uow.projects.count_by_owner(user_id) > 0:
                raise UserOwnsProjects("This user owns projects and cannot be deleted.")
            if user.role is Role.LEAD and await uow.users.count_leads(for_update=True) <= 1:
                raise LastLead("The last remaining lead cannot be deleted.")
            await uow.tasks.unassign_user(user_id)
            await uow.profiles.delete(user_id)
            await uow.users.delete(user_id)

        await transaction.write(self._uow, work)
