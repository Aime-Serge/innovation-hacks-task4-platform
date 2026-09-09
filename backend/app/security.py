from argon2 import PasswordHasher
from argon2.exceptions import InvalidHash, VerificationError, VerifyMismatchError

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
