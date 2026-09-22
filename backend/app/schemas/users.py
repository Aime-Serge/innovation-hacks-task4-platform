from typing import Annotated, ClassVar, Literal
from uuid import UUID

from pydantic import Field, StrictBool, StringConstraints

from app.domain.enums import Role, Theme
from app.domain.models import Member, Profile, ProfileStats, User
from app.domain.profile_rules import completeness
from app.schemas.base import (
    CLEAN,
    ApiModel,
    AvatarUrl,
    Email,
    Name,
    OutModel,
    PatchModel,
    SearchText,
    TimestampedOut,
)
from app.schemas.common import ListQuery, sort_param
from app.schemas.profiles import (
    PersonName,
    ProfileBlock,
    ProfileBlockDraft,
    ProfileOut,
)

# Passwords are never trimmed: whitespace is part of the secret.
Password = Annotated[
    str, StringConstraints(min_length=12, max_length=128, strip_whitespace=False, pattern=CLEAN)
]


class Preferences(OutModel):
    theme: Theme = Theme.SYSTEM


class UserCreate(ApiModel):
    """Registration (S-A): the account, the professional block, consent and the age check."""

    given_name: PersonName = Field(examples=["Ada"])
    family_name: PersonName = Field(examples=["Lovelace"])
    email: Email = Field(examples=["ada@example.com"])
    password: Password = Field(description="12 to 128 characters, not the email or the name.")
    profile: ProfileBlock
    terms_accepted: StrictBool = Field(
        description="Must be true; the terms version and time are stored."
    )
    age_confirmed: StrictBool = Field(description="Must be true: the person meets the minimum age.")
    avatar_url: AvatarUrl | None = None
    preferences: Preferences | None = None


class RegistrationCheck(ApiModel):
    """POST /users/validate: one step's fields, nothing created. Missing fields are named."""

    step: Literal[1, 2]
    given_name: PersonName | None = None
    family_name: PersonName | None = None
    email: Email | None = None
    password: Password | None = None
    profile: ProfileBlockDraft | None = None
    terms_accepted: StrictBool | None = None
    age_confirmed: StrictBool | None = None


class UserUpdate(PatchModel):
    nullable: ClassVar[frozenset[str]] = frozenset({"avatar_url"})

    name: Name | None = None
    avatar_url: AvatarUrl | None = None
    preferences: Preferences | None = None
    role: Role | None = Field(default=None, description="Only a lead may change a role.")


class UserOut(TimestampedOut):
    id: UUID
    name: str
    given_name: str | None = Field(description="Null for accounts made before the minimal profile.")
    family_name: str | None
    email: str | None  # BR-403: the user themself and leads only, otherwise null
    role: Role
    avatar_url: str | None
    preferences: Preferences
    profile: ProfileOut | None = Field(
        description="Null when the person hides their professional details from other members."
    )

    @classmethod
    def of(cls, member: Member, *, show_email: bool) -> "UserOut":
        user = member.user
        return cls(
            id=user.id,
            name=user.name,
            given_name=user.given_name,
            family_name=user.family_name,
            email=user.email if show_email else None,
            role=user.role,
            avatar_url=user.avatar_url,
            preferences=Preferences(theme=user.theme),
            profile=None if member.profile is None else ProfileOut.of(member.profile),
            created_at=user.created_at,
            updated_at=user.updated_at,
        )


class StatsOut(OutModel):
    projects_owned: int
    tasks_done: int
    tasks_open: int

    @classmethod
    def of(cls, stats: ProfileStats) -> "StatsOut":
        return cls(
            projects_owned=stats.projects_owned,
            tasks_done=stats.tasks_done,
            tasks_open=stats.tasks_open,
        )


class CompletenessOut(OutModel):
    percent: int = Field(ge=0, le=100)
    next: str | None = Field(description="The next suggested step, or null at 100.")


class PrivacyOut(OutModel):
    show_professional_details: bool


class MeOut(UserOut):
    """The signed-in person's own view: adds statistics, completeness and privacy (owner only)."""

    stats: StatsOut
    completeness: CompletenessOut
    privacy: PrivacyOut
    legacy_profile: bool = Field(
        description="True for accounts made before the minimal profile: prompt to complete it."
    )

    @classmethod
    def build(cls, user: User, profile: Profile, stats: ProfileStats) -> "MeOut":
        base = UserOut.of(Member(user, profile), show_email=True)
        score = completeness(user, profile)
        return cls(
            **{name: getattr(base, name) for name in UserOut.model_fields},
            stats=StatsOut.of(stats),
            completeness=CompletenessOut(percent=score.percent, next=score.next),
            privacy=PrivacyOut(show_professional_details=profile.show_professional_details),
            legacy_profile=profile.terms_version == "legacy",
        )


class UserListQuery(ListQuery):
    sort_fields: ClassVar[tuple[str, ...]] = ("name", "email", "createdAt")
    sort: str | None = sort_param(*sort_fields)
    q: SearchText | None = None
    role: Role | None = None
