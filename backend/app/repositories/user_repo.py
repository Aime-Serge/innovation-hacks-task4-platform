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
            session.flush()
            session.refresh(row)
            return _to_schema(row)

    def delete(self, user_id: UUID) -> None:
        with session_scope() as session:
            row = session.get(UserModel, user_id)
            if row is not None:
                session.delete(row)


user_repository = UserRepository()
