"""Initial schema: users, projects, tasks and activity (FR-301 to FR-309, FR-319).

Revision ID: 0001
Revises:
"""

from collections.abc import Sequence
from typing import Any

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

UUID_DEFAULT = sa.text("gen_random_uuid()")
NOW = sa.text("now()")


def _timestamps() -> list[sa.Column[Any]]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), server_default=UUID_DEFAULT, nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("role", sa.Text(), server_default="developer", nullable=False),
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column("theme", sa.Text(), server_default="system", nullable=False),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("email", name=op.f("uq_users_email")),
        sa.CheckConstraint(
            "char_length(name) BETWEEN 1 AND 80 AND name = btrim(name)",
            name=op.f("ck_users_name_length"),
        ),
        sa.CheckConstraint(
            "email = lower(email) AND char_length(email) <= 254 AND position('@' in email) > 0",
            name=op.f("ck_users_email_format"),
        ),
        sa.CheckConstraint(
            "char_length(password_hash) > 0", name=op.f("ck_users_password_hash_present")
        ),
        sa.CheckConstraint("role IN ('developer', 'lead')", name=op.f("ck_users_role")),
        sa.CheckConstraint(
            "avatar_url IS NULL OR "
            "(avatar_url LIKE 'https://%' AND char_length(avatar_url) <= 2048)",
            name=op.f("ck_users_avatar_url"),
        ),
        sa.CheckConstraint("theme IN ('light', 'dark', 'system')", name=op.f("ck_users_theme")),
    )
    op.create_table(
        "projects",
        sa.Column("id", sa.Uuid(), server_default=UUID_DEFAULT, nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), server_default="", nullable=False),
        sa.Column("status", sa.Text(), server_default="planned", nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_projects")),
        sa.ForeignKeyConstraint(
            ["owner_id"], ["users.id"], name=op.f("fk_projects_owner_id_users"), ondelete="RESTRICT"
        ),
        sa.CheckConstraint(
            "char_length(name) BETWEEN 1 AND 80 AND name = btrim(name)",
            name=op.f("ck_projects_name_length"),
        ),
        sa.CheckConstraint(
            "char_length(description) <= 2000", name=op.f("ck_projects_description_length")
        ),
        sa.CheckConstraint(
            "status IN ('planned', 'active', 'on_hold', 'completed')",
            name=op.f("ck_projects_status"),
        ),
    )
    op.create_table(
        "tasks",
        sa.Column("id", sa.Uuid(), server_default=UUID_DEFAULT, nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), server_default="", nullable=False),
        sa.Column("status", sa.Text(), server_default="todo", nullable=False),
        sa.Column("priority", sa.Text(), server_default="medium", nullable=False),
        sa.Column(
            "priority_rank",
            sa.SmallInteger(),
            sa.Computed(
                "CASE priority WHEN 'urgent' THEN 4 WHEN 'high' THEN 3 "
                "WHEN 'medium' THEN 2 ELSE 1 END",
                persisted=True,
            ),
            nullable=False,
        ),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("assignee_id", sa.Uuid(), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tasks")),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_tasks_project_id_projects"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["assignee_id"],
            ["users.id"],
            name=op.f("fk_tasks_assignee_id_users"),
            ondelete="SET NULL",
        ),
        sa.CheckConstraint(
            "char_length(title) BETWEEN 1 AND 120 AND title = btrim(title)",
            name=op.f("ck_tasks_title_length"),
        ),
        sa.CheckConstraint(
            "char_length(description) <= 4000", name=op.f("ck_tasks_description_length")
        ),
        sa.CheckConstraint(
            "status IN ('todo', 'in_progress', 'in_review', 'done')", name=op.f("ck_tasks_status")
        ),
        sa.CheckConstraint(
            "priority IN ('low', 'medium', 'high', 'urgent')", name=op.f("ck_tasks_priority")
        ),
        sa.CheckConstraint(
            "(status = 'done') = (completed_at IS NOT NULL)",
            name=op.f("ck_tasks_completed_consistency"),
        ),
    )
    op.create_table(
        "activity",
        sa.Column("id", sa.Uuid(), server_default=UUID_DEFAULT, nullable=False),
        sa.Column("actor_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("task_id", sa.Uuid(), nullable=True),
        sa.Column("type", sa.Text(), nullable=False),
        sa.Column("at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_activity")),
        sa.ForeignKeyConstraint(
            ["actor_id"], ["users.id"], name=op.f("fk_activity_actor_id_users"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_activity_project_id_projects"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["task_id"], ["tasks.id"], name=op.f("fk_activity_task_id_tasks"), ondelete="SET NULL"
        ),
        sa.CheckConstraint(
            "type IN ('created', 'status_changed', 'completed')", name=op.f("ck_activity_type")
        ),
    )


def downgrade() -> None:
    for table in ("activity", "tasks", "projects", "users"):
        op.drop_table(table)
