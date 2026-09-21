from typing import Annotated, ClassVar
from uuid import UUID

from pydantic import Field, StringConstraints

from app.domain.enums import Role, Theme
from app.domain.models import User
from app.schemas.base import (
    CLEAN,
    ApiModel,
    Email,
    HttpsUrl,
    Name,
    OutModel,
    PatchModel,
    SearchText,
    TimestampedOut,
)
from app.schemas.common import ListQuery, sort_param

# Passwords are never trimmed: whitespace is part of the secret.
Password = Annotated[
    str, StringConstraints(min_length=12, max_length=128, strip_whitespace=False, pattern=CLEAN)
]


class Preferences(OutModel):
    theme: Theme = Theme.SYSTEM


class UserCreate(ApiModel):
    name: Name = Field(examples=["Ada Lovelace"])
    email: Email = Field(examples=["ada@example.com"])
    password: Password = Field(description="12 to 128 characters, not equal to the email.")
    avatar_url: HttpsUrl | None = None
    preferences: Preferences | None = None


class UserUpdate(PatchModel):
    nullable: ClassVar[frozenset[str]] = frozenset({"avatar_url"})

    name: Name | None = None
    avatar_url: HttpsUrl | None = None
    preferences: Preferences | None = None
    role: Role | None = Field(default=None, description="Only a lead may change a role.")


class UserOut(TimestampedOut):
    id: UUID
    name: str
    email: str
    role: Role
    avatar_url: str | None
    preferences: Preferences

    @classmethod
    def of(cls, user: User) -> "UserOut":
        return cls(
            id=user.id,
            name=user.name,
            email=user.email,
            role=user.role,
            avatar_url=user.avatar_url,
            preferences=Preferences(theme=user.theme),
            created_at=user.created_at,
            updated_at=user.updated_at,
        )


class UserListQuery(ListQuery):
    sort_fields: ClassVar[tuple[str, ...]] = ("name", "email", "createdAt")
    sort: str | None = sort_param(*sort_fields)
    q: SearchText | None = None
    role: Role | None = None
