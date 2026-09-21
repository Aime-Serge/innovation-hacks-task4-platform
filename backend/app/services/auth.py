from app.core.clock import Clock
from app.core.errors import InvalidCredentials, Unauthenticated
from app.core.security import IssuedToken, PasswordHasher, TokenCodec
from app.domain.models import User
from app.services import transaction
from app.services.transaction import UowFactory


class AuthService:
    def __init__(
        self, uow: UowFactory, hasher: PasswordHasher, tokens: TokenCodec, clock: Clock
    ) -> None:
        self._uow = uow
        self._hasher = hasher
        self._tokens = tokens
        self._clock = clock

    async def login(self, email: str, password: str) -> IssuedToken:
        """Unknown email and wrong password are indistinguishable (FR-203, TH-203)."""
        # The only lookup that loads the password hash (NFR-318).
        user = await transaction.read(
            self._uow, lambda uow: uow.users.get_by_email(email, with_hash=True)
        )
        if user is None:
            await self._hasher.verify_dummy(password)
            raise InvalidCredentials("The email or password is incorrect.")
        if not await self._hasher.verify(user.password_hash, password):
            raise InvalidCredentials("The email or password is incorrect.")
        return self._tokens.issue(user.id, user.role.value, self._clock.now())

    async def authenticate(self, token: str) -> User:
        """The role is read from the store, so a demotion applies immediately (section 9)."""
        user_id = self._tokens.subject(token, self._clock.now())
        user = await transaction.read(self._uow, lambda uow: uow.users.get(user_id))
        if user is None:
            raise Unauthenticated("The access token is missing, invalid or expired.")
        return user
