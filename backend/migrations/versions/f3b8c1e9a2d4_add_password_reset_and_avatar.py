"""add password reset fields and avatar storage to users

Revision ID: f3b8c1e9a2d4
Revises: a1c3f9d2b7e4
Create Date: 2026-09-17 18:00:00.000000

Adds the columns needed for a full profile system: a hashed (never raw)
password-reset token + its expiry, and avatar storage (raw bytes + mime
type) kept directly on the users table rather than an external object-
storage service — avatars are capped small (see app/config.py) and this
avoids introducing a new third-party dependency/credential for what's a
modest amount of binary data.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f3b8c1e9a2d4'
down_revision: Union[str, Sequence[str], None] = 'a1c3f9d2b7e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users", sa.Column("password_reset_token_hash", sa.String(length=64), nullable=True)
    )
    op.add_column(
        "users",
        sa.Column("password_reset_expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column("users", sa.Column("avatar_data", sa.LargeBinary(), nullable=True))
    op.add_column("users", sa.Column("avatar_mime", sa.String(length=50), nullable=True))
    # Looked up on every login attempt (to decide "has an unexpired reset
    # token") if we ever list outstanding resets; cheap insurance now.
    op.create_index(
        "ix_users_password_reset_token_hash", "users", ["password_reset_token_hash"]
    )


def downgrade() -> None:
    op.drop_index("ix_users_password_reset_token_hash", table_name="users")
    op.drop_column("users", "avatar_mime")
    op.drop_column("users", "avatar_data")
    op.drop_column("users", "password_reset_expires_at")
    op.drop_column("users", "password_reset_token_hash")
