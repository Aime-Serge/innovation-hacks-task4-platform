from datetime import datetime
from uuid import UUID

from sqlalchemy import func

from app.db.models import UserModel
from app.db.session import session_scope
from app.models.user import UserInDB


def _to_schema(row: UserModel) -> UserInDB:
    return UserInDB(
        id=row.id,
        name=row.name,
        email=row.email,
        password_hash=row.password_hash,
        created_at=row.created_at,
        password_reset_token_hash=row.password_reset_token_hash,
        password_reset_expires_at=row.password_reset_expires_at,
        has_avatar=row.avatar_data is not None,
    )


class UserRepository:
    """Postgres-backed store for Task 3. Method signatures are unchanged
    from Task 2's in-memory store — routers never touch storage directly,
    so this swap required no route changes."""

    def list(self) -> list[UserInDB]:
        with session_scope() as session:
            rows = session.query(UserModel).order_by(UserModel.created_at).all()
            return [_to_schema(row) for row in rows]

    def get(self, user_id: UUID) -> UserInDB | None:
        with session_scope() as session:
            row = session.get(UserModel, user_id)
            return _to_schema(row) if row is not None else None

    def get_by_email(self, email: str) -> UserInDB | None:
        with session_scope() as session:
            row = (
                session.query(UserModel)
                .filter(func.lower(UserModel.email) == email.lower())
                .first()
            )
            return _to_schema(row) if row is not None else None

    def get_by_reset_token_hash(self, token_hash: str) -> UserInDB | None:
        with session_scope() as session:
            row = (
                session.query(UserModel)
                .filter(UserModel.password_reset_token_hash == token_hash)
                .first()
            )
            return _to_schema(row) if row is not None else None

    def create(self, user: UserInDB) -> UserInDB:
        with session_scope() as session:
            row = UserModel(
                id=user.id,
                name=user.name,
                email=user.email,
                password_hash=user.password_hash,
            )
            session.add(row)
            session.flush()
            session.refresh(row)
            return _to_schema(row)

    def update(self, user: UserInDB) -> UserInDB:
        with session_scope() as session:
            row = session.get(UserModel, user.id)
            row.name = user.name
            row.email = user.email
            row.password_hash = user.password_hash
            row.password_reset_token_hash = user.password_reset_token_hash
            row.password_reset_expires_at = user.password_reset_expires_at
            session.flush()
            session.refresh(row)
            return _to_schema(row)

    def delete(self, user_id: UUID) -> None:
        with session_scope() as session:
            row = session.get(UserModel, user_id)
            if row is not None:
                session.delete(row)

    def set_reset_token(
        self, user_id: UUID, token_hash: str | None, expires_at: datetime | None
    ) -> None:
        with session_scope() as session:
            row = session.get(UserModel, user_id)
            if row is not None:
                row.password_reset_token_hash = token_hash
                row.password_reset_expires_at = expires_at

    def get_avatar(self, user_id: UUID) -> tuple[bytes, str] | None:
        with session_scope() as session:
            row = session.get(UserModel, user_id)
            if row is None or row.avatar_data is None or row.avatar_mime is None:
                return None
            return row.avatar_data, row.avatar_mime

    def set_avatar(self, user_id: UUID, data: bytes, mime: str) -> None:
        with session_scope() as session:
            row = session.get(UserModel, user_id)
            if row is not None:
                row.avatar_data = data
                row.avatar_mime = mime

    def clear_avatar(self, user_id: UUID) -> None:
        with session_scope() as session:
            row = session.get(UserModel, user_id)
            if row is not None:
                row.avatar_data = None
                row.avatar_mime = None


user_repository = UserRepository()
