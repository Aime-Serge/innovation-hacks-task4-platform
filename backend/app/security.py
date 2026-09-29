import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHash, VerificationError, VerifyMismatchError

from app.config import get_settings

RESET_TOKEN_EXPIRE_MINUTES = 30

_TOKEN_SUBJECT_CLAIM = "sub"

# Argon2id, library defaults (OWASP's current top recommendation for
# password hashing — memory-hard, resists GPU/ASIC cracking better than
# PBKDF2 at any reasonable iteration count).
_password_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _password_hasher.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHash):
        return False


# A real Argon2 hash of an arbitrary fixed value — used by the login route
# to run a real verify() against a nonexistent account, so a failed login's
# timing doesn't reveal whether the email exists.
DUMMY_PASSWORD_HASH = _password_hasher.hash("dummy-password-for-constant-time-login")


def generate_reset_token() -> tuple[str, str]:
    """Returns (raw_token, token_hash). Only the hash is ever stored;
    the raw token goes into the reset link/response and is unrecoverable
    from the hash — same one-way discipline as password_hash, just a
    fast hash since this is a high-entropy random value, not low-entropy
    user input a slow hash would need to defend."""
    raw = secrets.token_urlsafe(32)
    return raw, hash_reset_token(raw)


def hash_reset_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()


def reset_token_matches(raw_token: str, token_hash: str) -> bool:
    return hmac.compare_digest(hash_reset_token(raw_token), token_hash)


def _require_secret_key() -> str:
    settings = get_settings()
    if not settings.secret_key:
        raise RuntimeError(
            "SECRET_KEY is not configured. Set it in your environment or .env file "
            "(see .env.example) — it signs auth tokens and has no insecure default."
        )
    return settings.secret_key


def create_access_token(user_id: UUID) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        _TOKEN_SUBJECT_CLAIM: str(user_id),
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, _require_secret_key(), algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> UUID | None:
    """Returns the user id encoded in the token, or None if the token is
    missing, expired, malformed, or signed with a different key."""
    settings = get_settings()
    try:
        payload = jwt.decode(token, _require_secret_key(), algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
        return None
    subject = payload.get(_TOKEN_SUBJECT_CLAIM)
    if subject is None:
        return None
    try:
        return UUID(subject)
    except ValueError:
        return None
