"""create users projects tasks tables

Revision ID: bdd9fa7e777a
Revises:
Create Date: 2026-09-09 07:49:21.866264

Schema mirrors the Task 2 domain (User, Project, Task) plus the two
relationships the API already enforces at the route level:
  - Project.owner_id -> User.id   (owner must exist to create a project)
  - Task.project_id  -> Project.id (project must exist to create a task)

Both foreign keys use ON DELETE CASCADE: Task 2's DELETE /users/{id}
already deletes unconditionally with no ownership check, so cascading
here preserves that exact external behavior instead of introducing a
new FK-violation error path Task 2 never had. There is no DELETE
/projects route yet, so the projects -> tasks cascade is schema-level
future-proofing per the same rule.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'bdd9fa7e777a'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# create_type=False: the type is created/dropped explicitly below via
# checkfirst, so op.create_table()/op.drop_table() don't also try to
# manage it (that would emit a duplicate CREATE TYPE against a real DB).
task_status = postgresql.ENUM(
    "todo", "in-progress", "done", name="task_status", create_type=False
)


def upgrade() -> None:
    task_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_unique_constraint("uq_users_email", "users", ["email"])

    op.create_table(
        "projects",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["owner_id"], ["users.id"], name="fk_projects_owner_id_users", ondelete="CASCADE"
        ),
    )
    op.create_index("ix_projects_owner_id", "projects", ["owner_id"])

    op.create_table(
        "tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "status",
            task_status,
            nullable=False,
            server_default="todo",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["project_id"], ["projects.id"], name="fk_tasks_project_id_projects", ondelete="CASCADE"
        ),
    )
    op.create_index("ix_tasks_project_id", "tasks", ["project_id"])
    op.create_index("ix_tasks_status", "tasks", ["status"])
    op.create_index("ix_tasks_project_id_status", "tasks", ["project_id", "status"])


def downgrade() -> None:
    op.drop_table("tasks")
    op.drop_table("projects")
    op.drop_table("users")
    task_status.drop(op.get_bind(), checkfirst=True)
