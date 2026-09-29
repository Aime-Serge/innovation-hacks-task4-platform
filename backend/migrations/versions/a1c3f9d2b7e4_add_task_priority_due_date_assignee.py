"""add task priority, due_date, assignee, and blocked status

Revision ID: a1c3f9d2b7e4
Revises: bdd9fa7e777a
Create Date: 2026-09-09 12:00:00.000000

Task 4 extends the task model with the fields the platform's task
management UI needs: priority, an optional due date, and an optional
assignee (any existing user, not necessarily the project owner). It also
adds "blocked" as a fourth task status to match the frontend's existing
`TaskStatus` union.

Note on downgrade: Postgres has no `ALTER TYPE ... DROP VALUE`, so the
`blocked` status value added here cannot be cleanly removed by downgrade.
downgrade() drops the columns/type added in this revision but leaves the
enum value in place — the same tradeoff the previous migration's `todo`/
`in-progress`/`done` values would have if reverted.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a1c3f9d2b7e4'
down_revision: Union[str, Sequence[str], None] = 'bdd9fa7e777a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

task_priority = postgresql.ENUM(
    "low", "medium", "high", name="task_priority", create_type=False
)


def upgrade() -> None:
    op.execute("ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'blocked'")

    task_priority.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "tasks",
        sa.Column("priority", task_priority, nullable=False, server_default="medium"),
    )
    op.add_column("tasks", sa.Column("due_date", sa.Date(), nullable=True))
    op.add_column(
        "tasks", sa.Column("assignee_id", postgresql.UUID(as_uuid=True), nullable=True)
    )

    op.create_foreign_key(
        "fk_tasks_assignee_id_users",
        "tasks",
        "users",
        ["assignee_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_tasks_priority", "tasks", ["priority"])
    op.create_index("ix_tasks_assignee_id", "tasks", ["assignee_id"])


def downgrade() -> None:
    op.drop_index("ix_tasks_assignee_id", table_name="tasks")
    op.drop_index("ix_tasks_priority", table_name="tasks")
    op.drop_constraint("fk_tasks_assignee_id_users", "tasks", type_="foreignkey")
    op.drop_column("tasks", "assignee_id")
    op.drop_column("tasks", "due_date")
    op.drop_column("tasks", "priority")
    task_priority.drop(op.get_bind(), checkfirst=True)
