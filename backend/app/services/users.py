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
from app.domain import profile_rules
from app.domain.enums import Discipline, EmploymentStatus, Role, Seniority, Theme
from app.domain.models import Member, Profile, User
from app.domain.unset import UNSET, Unset
from app.repositories.base import Page, UnitOfWork, UserQuery
from app.services import transaction
from app.services.authz import Actor, require_lead, require_self_or_lead
from app.services.transaction import UowFactory


@dataclass(frozen=True)
class RegistrationProfile:
    discipline: Discipline | None = None
    seniority: Seniority | None = None
    employment_status: EmploymentStatus | None = None
    company_name: str | None = None
    job_title: str | None = None
    country: str | None = None
    city: str | None = None
    time_zone: str | None = None


@dataclass(frozen=True)
class Registration:
    """Everything a registration step may carry. None means "not sent"."""

    given_name: str | None = None
    family_name: str | None = None
    email: str | None = None
    password: str | None = None
    profile: RegistrationProfile | None = None
    terms_accepted: bool | None = None
    age_confirmed: bool | None = None


def _need[T](value: T | None) -> T:
    """Narrow a field the step check has already proved present."""
    if value is None:
        raise RuntimeError("a required registration field was missing after validation")
    return value


def _member(viewer: UUID, user: User, profile: Profile | None) -> Member:
    """MB-02: the owner sees their profile; others only when the switch is on."""
    shown = profile is not None and (viewer == user.id or profile.show_professional_details)
    return Member(user, profile if shown else None)


def registration_problems(
    data: Registration, steps: tuple[int, ...], min_age: int
) -> list[ErrorDetail]:
    """Per-field messages for the given steps; the same rules serve validate and register."""
    found: list[ErrorDetail] = []
    if 1 in steps:
        found += _account_problems(data)
    if 2 in steps:
        found += _professional_problems(data, min_age)
    return found


def _account_problems(data: Registration) -> list[ErrorDetail]:
    found: list[ErrorDetail] = []
    for field, value, message in (
        ("givenName", data.given_name, "Enter your given name."),
        ("familyName", data.family_name, "Enter your family name."),
        ("email", data.email, "Enter your email address."),
        ("password", data.password, "Choose a password of 12 to 128 characters."),
    ):
        if value is None:
            found.append(ErrorDetail(field, message))
    if data.given_name and data.family_name:
        composed = profile_rules.compose_name(data.given_name, data.family_name)
        if len(composed) > profile_rules.MAX_DISPLAY_NAME:
            found.append(
                ErrorDetail(
                    "familyName", "Given and family name together may have at most 79 characters."
                )
            )
    if data.password is not None and _is_guessable(data):
        found.append(ErrorDetail("password", "Must not be the same as the email address or name."))
    return found


def _is_guessable(data: Registration) -> bool:
    lowered = _need(data.password).lower()
    names = {data.email, data.given_name, data.family_name}
    if data.given_name and data.family_name:
        names.add(profile_rules.compose_name(data.given_name, data.family_name))
    return any(name is not None and lowered == name.strip().lower() for name in names)


def _professional_problems(data: Registration, min_age: int) -> list[ErrorDetail]:
    found: list[ErrorDetail] = []
    profile = data.profile or RegistrationProfile()
    for field, value, message in (
        ("profile.discipline", profile.discipline, "Choose your discipline."),
        ("profile.seniority", profile.seniority, "Choose your seniority."),
        ("profile.employmentStatus", profile.employment_status, "Choose your employment status."),
        ("profile.country", profile.country, "Choose your country."),
        ("profile.timeZone", profile.time_zone, "Choose your time zone."),
    ):
        if value is None:
            found.append(ErrorDetail(field, message))
    if profile.employment_status is not None and profile_rules.needs_work_details(
        profile.employment_status
    ):
        found += work_detail_problems("profile.", profile.company_name, profile.job_title)
    if data.terms_accepted is not True:
        found.append(ErrorDetail("termsAccepted", "Accept the terms to continue."))
    if data.age_confirmed is not True:
        found.append(
            ErrorDetail("ageConfirmed", f"Confirm that you are at least {min_age} years old.")
        )
    return found


def work_detail_problems(prefix: str, company: str | None, title: str | None) -> list[ErrorDetail]:
    """MB-03: an employed or freelance person names a company (or "Independent") and a title."""
    found: list[ErrorDetail] = []
    if not company:
        found.append(ErrorDetail(f"{prefix}companyName", "Enter your company, or Independent."))
    if not title:
        found.append(ErrorDetail(f"{prefix}jobTitle", "Enter your job title."))
    return found


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
        self,
        uow: UowFactory,
        hasher: PasswordHasher,
        clock: Clock,
        ids: IdFactory,
        min_age: int = 16,
        terms_version: str = "2026-09",
    ) -> None:
        self._min_age = min_age
        self._terms_version = terms_version
        self._uow = uow
        self._hasher = hasher
        self._clock = clock
        self._ids = ids

    async def register(
        self,
        data: Registration,
        *,
        theme: Theme = Theme.SYSTEM,
        avatar_url: str | None = None,
        role: Role = Role.DEVELOPER,
    ) -> Member:
        """S-A, MF-01, MF-03: the account, its profile and the consent, in one transaction."""
        problems = registration_problems(data, (1, 2), self._min_age)
        if problems:
            raise ValidationFailed("One or more fields are invalid.", problems)
        given, family = _need(data.given_name), _need(data.family_name)
        details = data.profile or RegistrationProfile()
        normalised = _need(data.email).strip().lower()
        hashed = await self._hasher.hash(
            _need(data.password)
        )  # slow work stays outside the transaction
        now = self._clock.now()
        user = User(
            id=self._ids.new_id(),
            name=profile_rules.compose_name(given, family),
            email=normalised,
            password_hash=hashed,
            role=role,
            avatar_url=avatar_url,
            theme=theme,
            created_at=now,
            updated_at=now,
            given_name=given,
            family_name=family,
        )
        profile = Profile(
            user_id=user.id,
            discipline=_need(details.discipline),
            seniority=_need(details.seniority),
            employment_status=_need(details.employment_status),
            company_name=details.company_name,
            job_title=details.job_title,
            country_code=_need(details.country),
            city=details.city,
            time_zone=_need(details.time_zone),
            headline=None,
            about="",
            github_url=None,
            linkedin_url=None,
            website_url=None,
            show_professional_details=True,
            terms_version=self._terms_version,
            terms_accepted_at=now,
            age_confirmed_at=now,
            created_at=now,
            updated_at=now,
        )

        async def work(uow: UnitOfWork) -> Member:
            if await uow.users.get_by_email(normalised) is not None:
                raise EmailAlreadyExists("An account with this email already exists.")
            await uow.users.add(user)  # uq_users_email closes the race (FR-307)
            await uow.profiles.add(profile)
            return Member(user, profile)

        return await transaction.write(self._uow, work)

    def validate_registration(self, step: int, data: Registration) -> None:
        """MF-01: check one step and create nothing. Every problem is named, not only the first."""
        problems = registration_problems(data, (step,), self._min_age)
        if problems:
            raise ValidationFailed("One or more fields are invalid.", problems)

    async def list(self, query: UserQuery) -> Page[User]:
        return await transaction.read(self._uow, lambda uow: uow.users.list(query))

    async def list_members(self, viewer: UUID, query: UserQuery) -> Page[Member]:
        """S-B, MF-16: another member's profile appears only when their switch is on."""

        async def work(uow: UnitOfWork) -> Page[Member]:
            page = await uow.users.list(query)
            profiles = await uow.profiles.get_many([user.id for user in page.items])
            items = [_member(viewer, user, profiles.get(user.id)) for user in page.items]
            return Page(items, page.page, page.page_size, page.total)

        return await transaction.read(self._uow, work)

    async def get_member(self, viewer: UUID, user_id: UUID) -> Member:
        async def work(uow: UnitOfWork) -> Member:
            user = await _require_user(uow, user_id)
            return _member(viewer, user, await uow.profiles.get(user_id))

        return await transaction.read(self._uow, work)

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
            await uow.profiles.delete(user_id)
            await uow.users.delete(user_id)

        await transaction.write(self._uow, work)


async def _check_demotion(uow: UnitOfWork, target: User, new_role: Role) -> None:
    demoting = target.role is Role.LEAD and new_role is not Role.LEAD
    # Lock the lead rows, then count, so two demotions cannot both see "two leads" (BR-306).
    if demoting and await uow.users.count_leads(for_update=True) <= 1:
        raise LastLead("The last remaining lead cannot be demoted.")  # BR-208
