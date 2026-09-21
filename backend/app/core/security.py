"""Password hashing (argon2id, off the event loop) and JWT handling (TH-202, NFR-212)."""

import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta
from uuid import UUID

import jwt
from argon2 import PasswordHasher as Argon2Hasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.core.errors import Unauthenticated

ALGORITHM = "HS256"


class PasswordHasher:
    def __init__(self, time_cost: int, memory_kib: int) -> None:
        self._hasher = Argon2Hasher(time_cost=time_cost, memory_cost=memory_kib, parallelism=1)
        # Verified against when the email is unknown, so timing does not reveal it (TH-203).
        self._dummy = self._hasher.hash("dummy-password-for-timing")

    async def hash(self, password: str) -> str:
        return await asyncio.to_thread(self._hasher.hash, password)

    async def verify(self, password_hash: str, password: str) -> bool:
        return await asyncio.to_thread(self._verify, password_hash, password)

    async def verify_dummy(self, password: str) -> None:
        await asyncio.to_thread(self._verify, self._dummy, password)

    def _verify(self, password_hash: str, password: str) -> bool:
        try:
            return self._hasher.verify(password_hash, password)
        except (VerificationError, InvalidHashError):
            return False


@dataclass(frozen=True)
class IssuedToken:
    access_token: str
    expires_in: int


class TokenCodec:
    def __init__(self, secret: str, issuer: str, audience: str, ttl_seconds: int) -> None:
        self._secret = secret
        self._issuer = issuer
        self._audience = audience
        self._ttl = ttl_seconds

    def issue(self, user_id: UUID, role: str, now: datetime) -> IssuedToken:
        claims = {
            "sub": str(user_id),
            "role": role,
            "iss": self._issuer,
            "aud": self._audience,
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(seconds=self._ttl)).timestamp()),
        }
        return IssuedToken(jwt.encode(claims, self._secret, algorithm=ALGORITHM), self._ttl)

    def subject(self, token: str, now: datetime) -> UUID:
        """Return the user id, or raise Unauthenticated. The algorithm is pinned, `none` fails.

        Expiry is checked against the injected clock, not the wall clock, so it is testable.
        """
        try:
            claims = jwt.decode(
                token,
                self._secret,
                algorithms=[ALGORITHM],
                issuer=self._issuer,
                audience=self._audience,
                options={
                    "require": ["exp", "iat", "iss", "aud", "sub"],
                    "verify_exp": False,
                    "verify_iat": False,
                },
            )
            if int(claims["exp"]) <= now.timestamp() or int(claims["iat"]) > now.timestamp():
                raise Unauthenticated("The access token is missing, invalid or expired.")
            return UUID(str(claims["sub"]))
        except (jwt.PyJWTError, ValueError, TypeError):
            raise Unauthenticated("The access token is missing, invalid or expired.") from None
