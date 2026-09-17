from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserOut


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    message: str
    # Dev-mode only: this build has no email provider wired up (see the
    # README/security notes), so instead of emailing a reset link, the
    # link is handed back directly in this response for the frontend to
    # display. A real deployment MUST remove this field and email the
    # link instead — returning it here means anyone who can call this
    # endpoint with a known email gets that account's reset link, which
    # is a real account-takeover vector if this were ever pointed at
    # genuine user data. Never populated for third parties in a real
    # rollout; kept explicit and loud here rather than quietly shipped.
    dev_reset_url: str | None = None


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)
