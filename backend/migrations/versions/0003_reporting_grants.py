"""Read-only reporting role: every table, but not users.password_hash (TH-305, FR-317).

The roles are created by the operator (database/init/roles.sh). This revision only grants, and does
nothing where a role does not exist, so a bare database still migrates.

Revision ID: 0003
Revises: 0002
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ih_readonly') THEN
            GRANT SELECT ON projects, tasks, activity TO ih_readonly;
            GRANT SELECT (id, name, email, role, avatar_url, theme, created_at, updated_at)
              ON users TO ih_readonly;
          END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ih_readonly') THEN
            REVOKE ALL ON users, projects, tasks, activity FROM ih_readonly;
          END IF;
        END $$;
        """
    )
