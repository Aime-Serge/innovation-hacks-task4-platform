#!/usr/bin/env bash
# Turn a SQLAlchemy URL (postgresql+asyncpg://...) into a libpq one for pg_dump and psql.
set -euo pipefail
echo "${1/postgresql+asyncpg:/postgresql:}"
