from datetime import datetime, timezone
from uuid import UUID, uuid4

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserUpdate(BaseModel):
    """Profile edit — name/email only. Password changes go through the
    dedicated /users/{id}/change-password endpoint, which requires the
    current password; folding a password field into a generic PATCH
    would let a hijacked session silently lock the real owner out
    without ever proving it knew the old password."""

    name: str | None = Field(default=None, min_length=1, max_length=100)
    email: EmailStr | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class UserOut(BaseModel):
    id: UUID
    name: str
    email: EmailStr
    created_at: datetime
    has_avatar: bool = False


class UserInDB(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    name: str
    email: EmailStr
    password_hash: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    password_reset_token_hash: str | None = None
    password_reset_expires_at: datetime | None = None
    has_avatar: bool = False

    def to_out(self) -> UserOut:
        return UserOut(
            id=self.id,
            name=self.name,
            email=self.email,
            created_at=self.created_at,
            has_avatar=self.has_avatar,
        )
