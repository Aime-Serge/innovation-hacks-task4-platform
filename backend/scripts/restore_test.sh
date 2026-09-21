#!/usr/bin/env bash
# `make db-restore-test`: take a fresh dump of the compose database, restore it into a scratch copy,
# and compare row counts and key checksums (FR-324, NFR-311). Runs pg_dump inside the container, so
# no client tools are needed on the host, and the dump never leaves the temporary directory.
set -euo pipefail
: "${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env}"
CONTAINER="$(docker compose -f database/docker-compose.yml --env-file .env ps -q db)"
DB="${POSTGRES_DB:-ih_platform}"; ADMIN="${POSTGRES_USER:-ih_admin}"
SCRATCH="devdash_restore_$$"
DUMP="$(mktemp -d)/devdash.dump"
run() { docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$CONTAINER" "$@"; }
cleanup() { run psql -U "$ADMIN" -d postgres -qc "DROP DATABASE IF EXISTS $SCRATCH WITH (FORCE)" >/dev/null 2>&1 || true; rm -rf "$(dirname "$DUMP")"; }
trap cleanup EXIT
run pg_dump -U "$ADMIN" --format=custom --compress=9 --no-owner "$DB" > "$DUMP"
run psql -U "$ADMIN" -d postgres -qc "CREATE DATABASE $SCRATCH"
docker exec -i -e PGPASSWORD="$POSTGRES_PASSWORD" "$CONTAINER" pg_restore -U "$ADMIN" --no-owner -d "$SCRATCH" < "$DUMP"
fingerprint() {
  run psql -U "$ADMIN" -d "$1" -Atqc "
    SELECT 'users ' || count(*) || ' ' || coalesce(md5(string_agg(id::text, ',' ORDER BY id)), '-') FROM users
    UNION ALL SELECT 'projects ' || count(*) || ' ' || coalesce(md5(string_agg(id::text, ',' ORDER BY id)), '-') FROM projects
    UNION ALL SELECT 'tasks ' || count(*) || ' ' || coalesce(md5(string_agg(id::text, ',' ORDER BY id)), '-') FROM tasks
    UNION ALL SELECT 'activity ' || count(*) || ' ' || coalesce(md5(string_agg(id::text, ',' ORDER BY id)), '-') FROM activity"
}
SOURCE="$(fingerprint "$DB")"; RESTORED="$(fingerprint "$SCRATCH")"
echo "$SOURCE"
if [ "$SOURCE" != "$RESTORED" ]; then echo "RESTORE MISMATCH" >&2; diff <(echo "$SOURCE") <(echo "$RESTORED") >&2 || true; exit 1; fi
echo "Restore verified: row counts and primary-key checksums match."
