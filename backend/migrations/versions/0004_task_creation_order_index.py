"""Index for the default task order, which the xl load test showed was missing (Phase 8).

`GET /tasks` sorts by `created_at` unless told otherwise, and without an index every page sorted all
20,000 tasks. This serves `ORDER BY created_at, id LIMIT n` directly.

Revision ID: 0004
Revises: 0003
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(op.f("ix_tasks_created_at_id"), "tasks", ["created_at", "id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_tasks_created_at_id"), table_name="tasks")
