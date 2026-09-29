#!/usr/bin/env bash
# One-time database provisioning (section 8): creates ih_migrator, ih_app and ih_readonly with
# passwords taken from YOUR shell environment. Run from your machine, with the administrator
# connection restricted to your IP address. Nothing here is stored or printed.
#
#   ADMIN_DATABASE_URL     psql-style admin URL:  postgresql://user:pass@host/db?sslmode=require
#   MIGRATOR_DB_PASSWORD   password for ih_migrator (letters and digits)
#   APP_DB_PASSWORD        password for ih_app
#   READONLY_DB_PASSWORD   password for ih_readonly
set -euo pipefail
: "${ADMIN_DATABASE_URL:?Set ADMIN_DATABASE_URL in your shell}"
: "${MIGRATOR_DB_PASSWORD:?Set MIGRATOR_DB_PASSWORD in your shell}"
: "${APP_DB_PASSWORD:?Set APP_DB_PASSWORD in your shell}"
: "${READONLY_DB_PASSWORD:?Set READONLY_DB_PASSWORD in your shell}"
case "$ADMIN_DATABASE_URL" in postgres://*|postgresql://*) ;; *) echo "ADMIN_DATABASE_URL must start with postgresql://" >&2; exit 2;; esac

if command -v psql >/dev/null 2>&1; then PSQL=(psql); else PSQL=(docker run --rm -i --network host postgres:16.4 psql); fi

DB="$("${PSQL[@]}" "$ADMIN_DATABASE_URL" -Atc 'select current_database()')"
echo "Provisioning roles on database: $DB"
"${PSQL[@]}" "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -v migrator_pw="$MIGRATOR_DB_PASSWORD" -v app_pw="$APP_DB_PASSWORD" \
  -v readonly_pw="$READONLY_DB_PASSWORD" -v db="$DB" <<'SQL'
CREATE ROLE ih_migrator LOGIN PASSWORD :'migrator_pw' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE ROLE ih_app      LOGIN PASSWORD :'app_pw'      NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE ROLE ih_readonly LOGIN PASSWORD :'readonly_pw' NOSUPERUSER NOCREATEDB NOCREATEROLE;
SELECT format('GRANT CONNECT, CREATE ON DATABASE %I TO ih_migrator', :'db') \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO ih_app, ih_readonly', :'db') \gexec
GRANT ALL ON SCHEMA public TO ih_migrator;
GRANT USAGE ON SCHEMA public TO ih_app, ih_readonly;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
SQL
# Rows only for the API on everything the migrator creates later (run as the migrator).
MIGRATOR_URL="$(python3 - <<PY
import os, urllib.parse as u
p = u.urlsplit(os.environ["ADMIN_DATABASE_URL"])
host = p.hostname + (f":{p.port}" if p.port else "")
print(u.urlunsplit((p.scheme, f"ih_migrator:{u.quote(os.environ['MIGRATOR_DB_PASSWORD'])}@{host}", p.path, p.query, "")))
PY
)"
"${PSQL[@]}" "$MIGRATOR_URL" -v ON_ERROR_STOP=1 \
  -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ih_app"
echo "Roles created. Next: make db-migrate-prod"
