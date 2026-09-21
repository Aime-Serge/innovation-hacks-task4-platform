"""Index for "assigned in this project", which BR-401 asks on every non-lead request.

Revision ID: 0007
Revises: 0006
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        op.f("ix_tasks_assignee_id_project_id"),
        "tasks",
        ["assignee_id", "project_id"],
        postgresql_where=sa.text("assignee_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_tasks_assignee_id_project_id"), table_name="tasks")
