"""AI usage records (FR-430, BR-409). Additive and reversible.

Metadata only: no prompt or output text is stored (ADR-411). The read-only role gets nothing here.

Revision ID: 0006
Revises: 0005
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ai_requests",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("feature", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("provider", sa.Text(), nullable=False),
        sa.Column("model", sa.Text(), nullable=True),
        sa.Column("prompt_version", sa.Text(), nullable=False),
        sa.Column("input_tokens", sa.Integer(), nullable=True),
        sa.Column("output_tokens", sa.Integer(), nullable=True),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("error_code", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "feature IN ('task_generation', 'prioritization', 'project_summary')",
            name=op.f("ck_ai_requests_feature"),
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'success', 'provider_error', 'invalid_output', "
            "'quota_blocked', 'disabled')",
            name=op.f("ck_ai_requests_status"),
        ),
        sa.CheckConstraint(
            "char_length(provider) <= 40", name=op.f("ck_ai_requests_provider_length")
        ),
        sa.CheckConstraint(
            "model IS NULL OR char_length(model) <= 100", name=op.f("ck_ai_requests_model_length")
        ),
        sa.CheckConstraint(
            "char_length(prompt_version) <= 60", name=op.f("ck_ai_requests_prompt_version_length")
        ),
        sa.CheckConstraint(
            "input_tokens IS NULL OR input_tokens >= 0",
            name=op.f("ck_ai_requests_input_tokens_min"),
        ),
        sa.CheckConstraint(
            "output_tokens IS NULL OR output_tokens >= 0",
            name=op.f("ck_ai_requests_output_tokens_min"),
        ),
        sa.CheckConstraint(
            "latency_ms IS NULL OR latency_ms >= 0", name=op.f("ck_ai_requests_latency_ms_min")
        ),
        sa.CheckConstraint(
            "error_code IS NULL OR char_length(error_code) <= 60",
            name=op.f("ck_ai_requests_error_code_length"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_ai_requests_user_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_ai_requests")),
    )
    op.create_index(
        op.f("ix_ai_requests_user_id_created_at"),
        "ai_requests",
        ["user_id", sa.text("created_at DESC")],
    )
    op.create_index(op.f("ix_ai_requests_created_at"), "ai_requests", ["created_at"])


def downgrade() -> None:
    op.drop_index(op.f("ix_ai_requests_created_at"), table_name="ai_requests")
    op.drop_index(op.f("ix_ai_requests_user_id_created_at"), table_name="ai_requests")
    op.drop_table("ai_requests")
