#!/usr/bin/env bash
# Creates the three database roles the first time the container starts (FR-317, ADR-308).
# Passwords come only from the environment; there are no defaults.
set -euo pipefail
: "${APP_DB_PASSWORD:?Set APP_DB_PASSWORD in .env}"
: "${MIGRATOR_DB_PASSWORD:?Set MIGRATOR_DB_PASSWORD in .env}"
: "${READONLY_DB_PASSWORD:?Set READONLY_DB_PASSWORD in .env}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v app_pw="$APP_DB_PASSWORD" -v migrator_pw="$MIGRATOR_DB_PASSWORD" \
  -v readonly_pw="$READONLY_DB_PASSWORD" -v db="$POSTGRES_DB" <<'SQL'
CREATE ROLE ih_migrator LOGIN PASSWORD :'migrator_pw' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE ROLE ih_app      LOGIN PASSWORD :'app_pw'      NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE ROLE ih_readonly LOGIN PASSWORD :'readonly_pw' NOSUPERUSER NOCREATEDB NOCREATEROLE;

-- The migration role owns the database, so it (and only it) can create and change objects.
SELECT format('ALTER DATABASE %I OWNER TO ih_migrator', :'db') \gexec
SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', :'db') \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO ih_app, ih_readonly', :'db') \gexec

-- Rows only, for the API. Objects the migrator creates later are covered automatically.
-- ih_readonly gets no default: its grants are column by column, in a migration, so the hash is out.
ALTER DEFAULT PRIVILEGES FOR ROLE ih_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ih_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO ih_app, ih_readonly;
SQL
