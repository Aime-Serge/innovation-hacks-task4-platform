"""Avatar photos may be an inline data: URL, not only an https link (ADR-426).

Registration can now take a photo. There is no object storage in this release, so an uploaded
photo is stored as its own bytes: a base64 `data:image/(png|jpeg|webp)` URL, capped at 700,000
characters, which is the 500 KB the client allows a file to be plus base64's ~4/3 inflation.
An https link is still allowed, unchanged, at its own 2,048 limit. Nothing already stored can
break: every existing value is an https link, which the new rule still accepts.

Revision ID: 0009
Revises: 0008
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

AVATAR_DATA_MAX = 700_000

_HTTPS = "avatar_url LIKE 'https://%' AND char_length(avatar_url) <= 2048"
_DATA = (
    "avatar_url ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$'"
    f" AND char_length(avatar_url) <= {AVATAR_DATA_MAX}"
)


def upgrade() -> None:
    op.drop_constraint("avatar_url", "users", type_="check")
    op.create_check_constraint(
        "avatar_url", "users", f"avatar_url IS NULL OR ({_HTTPS}) OR ({_DATA})"
    )


def downgrade() -> None:
    # An inline photo cannot satisfy the old https-only rule, so drop those values rather than
    # fail the downgrade on them. The account and everything else about it is untouched; the
    # person simply shows their initials again, which is what they had before this release.
    op.execute("UPDATE users SET avatar_url = NULL WHERE avatar_url LIKE 'data:%'")
    op.drop_constraint("avatar_url", "users", type_="check")
    op.create_check_constraint("avatar_url", "users", f"avatar_url IS NULL OR ({_HTTPS})")
