#!/usr/bin/env bash
# The explicit migration step of the release order (FR-439, ADR-413). Run from your machine with
# the migration role. The URL is read from your shell and never set on any platform service.
#
#   MIGRATION_DATABASE_URL  postgresql+asyncpg://ih_migrator:...@host/db?ssl=require
#   CONFIRM_PROD=yes        an explicit yes, because this changes the production schema
set -euo pipefail
: "${MIGRATION_DATABASE_URL:?Set MIGRATION_DATABASE_URL in your shell}"
[ "${CONFIRM_PROD:-}" = "yes" ] || { echo "Set CONFIRM_PROD=yes to migrate." >&2; exit 2; }
case "$MIGRATION_DATABASE_URL" in postgresql+asyncpg://*ssl=require*) ;; *) echo "MIGRATION_DATABASE_URL must be postgresql+asyncpg://... with ?ssl=require" >&2; exit 2;; esac
python3 -c "import os,urllib.parse as u;p=u.urlsplit(os.environ['MIGRATION_DATABASE_URL']);print('Migrating', p.hostname, p.path, 'as', p.username)"
cd "$(dirname "$0")/../backend"
uv run --frozen alembic upgrade head
uv run --frozen alembic current
