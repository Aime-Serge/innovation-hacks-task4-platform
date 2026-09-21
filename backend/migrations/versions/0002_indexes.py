"""Indexes: one per foreign key, plus one per named query, and pg_trgm search (section 6).

Revision ID: 0002
Revises: 0001
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")  # ADR-309, run by the migration role
    op.create_index(op.f("ix_users_role"), "users", ["role"])
    op.create_index(op.f("ix_projects_owner_id"), "projects", ["owner_id"])
    op.create_index(op.f("ix_projects_status"), "projects", ["status"])
    op.create_index(
        op.f("ix_projects_name_trgm"),
        "projects",
        ["name"],
        postgresql_using="gin",
        postgresql_ops={"name": "gin_trgm_ops"},
    )
    op.create_index(op.f("ix_tasks_project_id_status"), "tasks", ["project_id", "status"])
    op.create_index(
        op.f("ix_tasks_assignee_id_status"),
        "tasks",
        ["assignee_id", "status"],
        postgresql_where=sa.text("assignee_id IS NOT NULL"),
    )
    op.create_index(
        op.f("ix_tasks_due_date_open"),
        "tasks",
        ["due_date"],
        postgresql_where=sa.text("status <> 'done'"),
    )
    op.create_index(op.f("ix_tasks_due_date_id"), "tasks", ["due_date", "id"])
    op.create_index(
        op.f("ix_tasks_priority_rank_id"), "tasks", [sa.text("priority_rank DESC"), "id"]
    )
    op.create_index(
        op.f("ix_tasks_title_trgm"),
        "tasks",
        ["title"],
        postgresql_using="gin",
        postgresql_ops={"title": "gin_trgm_ops"},
    )
    op.create_index(
        op.f("ix_tasks_description_trgm"),
        "tasks",
        ["description"],
        postgresql_using="gin",
        postgresql_ops={"description": "gin_trgm_ops"},
    )
    op.create_index(op.f("ix_activity_at_id"), "activity", [sa.text("at DESC"), sa.text("id DESC")])
    op.create_index(op.f("ix_activity_actor_id"), "activity", ["actor_id"])
    op.create_index(op.f("ix_activity_project_id"), "activity", ["project_id"])
    op.create_index(op.f("ix_activity_task_id"), "activity", ["task_id"])


def downgrade() -> None:
    for name, table in (
        ("ix_activity_task_id", "activity"),
        ("ix_activity_project_id", "activity"),
        ("ix_activity_actor_id", "activity"),
        ("ix_activity_at_id", "activity"),
        ("ix_tasks_description_trgm", "tasks"),
        ("ix_tasks_title_trgm", "tasks"),
        ("ix_tasks_priority_rank_id", "tasks"),
        ("ix_tasks_due_date_id", "tasks"),
        ("ix_tasks_due_date_open", "tasks"),
        ("ix_tasks_assignee_id_status", "tasks"),
        ("ix_tasks_project_id_status", "tasks"),
        ("ix_projects_name_trgm", "projects"),
        ("ix_projects_status", "projects"),
        ("ix_projects_owner_id", "projects"),
        ("ix_users_role", "users"),
    ):
        op.drop_index(op.f(name), table_name=table)
    op.execute("DROP EXTENSION IF EXISTS pg_trgm")
