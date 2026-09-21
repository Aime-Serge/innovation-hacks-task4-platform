"""ORM models: the section 6 schema, with the naming convention that error mapping relies on.

Every constraint and index is named (ADR-305). Migrations are written by hand from this metadata
(BR-310), and `alembic check` proves the two agree. There are no ORM relationships: every load is an
explicit query, so nothing can lazy-load (`lazy="raise"` holds by construction).
"""

from datetime import date, datetime
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    Computed,
    Date,
    DateTime,
    ForeignKey,
    Index,
    MetaData,
    SmallInteger,
    Text,
    Uuid,
    text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

NAMING_CONVENTION = {
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

UUID_DEFAULT = text("gen_random_uuid()")
NOW = text("now()")


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class UserRow(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, server_default=UUID_DEFAULT)
    name: Mapped[str] = mapped_column(Text)
    email: Mapped[str] = mapped_column(Text, unique=True)
    password_hash: Mapped[str] = mapped_column(Text)
    role: Mapped[str] = mapped_column(Text, server_default="developer")
    avatar_url: Mapped[str | None] = mapped_column(Text)
    theme: Mapped[str] = mapped_column(Text, server_default="system")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=NOW)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=NOW)

    __table_args__ = (
        CheckConstraint(
            "char_length(name) BETWEEN 1 AND 80 AND name = btrim(name)", name="name_length"
        ),
        CheckConstraint(
            "email = lower(email) AND char_length(email) <= 254 AND position('@' in email) > 0",
            name="email_format",
        ),
        CheckConstraint("char_length(password_hash) > 0", name="password_hash_present"),
        CheckConstraint("role IN ('developer', 'lead')", name="role"),
        CheckConstraint(
            "avatar_url IS NULL OR "
            "(avatar_url LIKE 'https://%' AND char_length(avatar_url) <= 2048)",
            name="avatar_url",
        ),
        CheckConstraint("theme IN ('light', 'dark', 'system')", name="theme"),
        Index("ix_users_role", "role"),
    )


class ProjectRow(Base):
    __tablename__ = "projects"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, server_default=UUID_DEFAULT)
    name: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text, server_default="")
    status: Mapped[str] = mapped_column(Text, server_default="planned")
    due_date: Mapped[date | None] = mapped_column(Date)
    owner_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="RESTRICT"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=NOW)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=NOW)

    __table_args__ = (
        CheckConstraint(
            "char_length(name) BETWEEN 1 AND 80 AND name = btrim(name)", name="name_length"
        ),
        CheckConstraint("char_length(description) <= 2000", name="description_length"),
        CheckConstraint("status IN ('planned', 'active', 'on_hold', 'completed')", name="status"),
        Index("ix_projects_owner_id", "owner_id"),
        Index("ix_projects_status", "status"),
        Index(
            "ix_projects_name_trgm",
            "name",
            postgresql_using="gin",
            postgresql_ops={"name": "gin_trgm_ops"},
        ),
    )


class TaskRow(Base):
    __tablename__ = "tasks"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, server_default=UUID_DEFAULT)
    project_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("projects.id", ondelete="RESTRICT"))
    title: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text, server_default="")
    status: Mapped[str] = mapped_column(Text, server_default="todo")
    priority: Mapped[str] = mapped_column(Text, server_default="medium")
    priority_rank: Mapped[int] = mapped_column(
        SmallInteger,
        Computed(
            "CASE priority WHEN 'urgent' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END",
            persisted=True,
        ),
    )
    due_date: Mapped[date | None] = mapped_column(Date)
    assignee_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL")
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=NOW)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=NOW)

    __table_args__ = (
        CheckConstraint(
            "char_length(title) BETWEEN 1 AND 120 AND title = btrim(title)", name="title_length"
        ),
        CheckConstraint("char_length(description) <= 4000", name="description_length"),
        CheckConstraint("status IN ('todo', 'in_progress', 'in_review', 'done')", name="status"),
        CheckConstraint("priority IN ('low', 'medium', 'high', 'urgent')", name="priority"),
        CheckConstraint(
            "(status = 'done') = (completed_at IS NOT NULL)", name="completed_consistency"
        ),
        Index("ix_tasks_project_id_status", "project_id", "status"),
        Index(
            "ix_tasks_assignee_id_status",
            "assignee_id",
            "status",
            postgresql_where=text("assignee_id IS NOT NULL"),
        ),
        Index("ix_tasks_due_date_open", "due_date", postgresql_where=text("status <> 'done'")),
        Index("ix_tasks_due_date_id", "due_date", "id"),
        Index("ix_tasks_created_at_id", "created_at", "id"),
        Index("ix_tasks_priority_rank_id", text("priority_rank DESC"), "id"),
        Index(
            "ix_tasks_title_trgm",
            "title",
            postgresql_using="gin",
            postgresql_ops={"title": "gin_trgm_ops"},
        ),
        Index(
            "ix_tasks_description_trgm",
            "description",
            postgresql_using="gin",
            postgresql_ops={"description": "gin_trgm_ops"},
        ),
    )


class ActivityRow(Base):
    __tablename__ = "activity"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, server_default=UUID_DEFAULT)
    actor_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"))
    project_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("projects.id", ondelete="CASCADE"))
    task_id: Mapped[UUID | None] = mapped_column(Uuid, ForeignKey("tasks.id", ondelete="SET NULL"))
    type: Mapped[str] = mapped_column(Text)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=NOW)

    __table_args__ = (
        CheckConstraint("type IN ('created', 'status_changed', 'completed')", name="type"),
        Index("ix_activity_at_id", text("at DESC"), text("id DESC")),
        Index("ix_activity_actor_id", "actor_id"),
        Index("ix_activity_project_id", "project_id"),
        Index("ix_activity_task_id", "task_id"),
    )
