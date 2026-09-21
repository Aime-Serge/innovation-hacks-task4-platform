#!/usr/bin/env bash
# Restore the newest dump into a scratch database and compare it with the source (FR-324, NFR-311):
# row counts per table, and a checksum of the ordered primary keys.
# Usage: BACKUP_DATABASE_URL=... ADMIN_DATABASE_URL=... database/scripts/restore-test.sh [dump-dir]
set -euo pipefail
: "${BACKUP_DATABASE_URL:?Set BACKUP_DATABASE_URL}"
: "${ADMIN_DATABASE_URL:?Set ADMIN_DATABASE_URL (a role that may create databases; used for the scratch copy)}"
DIR="${1:-${BACKUP_DIR:-$HOME/.devdash-backups}}"
DUMP="$(ls -t "$DIR"/devdash-*.dump | head -1)"
SCRATCH="devdash_restore_$$"
ADMIN_BASE="${ADMIN_DATABASE_URL%/*}"
cleanup() { psql "$ADMIN_DATABASE_URL" -qc "DROP DATABASE IF EXISTS $SCRATCH WITH (FORCE)" >/dev/null 2>&1 || true; }
trap cleanup EXIT
psql "$ADMIN_DATABASE_URL" -qc "CREATE DATABASE $SCRATCH"
pg_restore --no-owner --dbname "$ADMIN_BASE/$SCRATCH" "$DUMP"

fingerprint() {
  psql "$1" -Atqc "
    SELECT 'users ' || count(*) || ' ' || coalesce(md5(string_agg(id::text, ',' ORDER BY id)), '-') FROM users
    UNION ALL SELECT 'projects ' || count(*) || ' ' || coalesce(md5(string_agg(id::text, ',' ORDER BY id)), '-') FROM projects
    UNION ALL SELECT 'tasks ' || count(*) || ' ' || coalesce(md5(string_agg(id::text, ',' ORDER BY id)), '-') FROM tasks
    UNION ALL SELECT 'activity ' || count(*) || ' ' || coalesce(md5(string_agg(id::text, ',' ORDER BY id)), '-') FROM activity"
}
SOURCE="$(fingerprint "$BACKUP_DATABASE_URL")"
RESTORED="$(fingerprint "$ADMIN_BASE/$SCRATCH")"
echo "$SOURCE"
if [ "$SOURCE" != "$RESTORED" ]; then
  echo "RESTORE MISMATCH" >&2
  diff <(echo "$SOURCE") <(echo "$RESTORED") >&2 || true
  exit 1
fi
echo "Restore verified: counts and key checksums match ($DUMP)."
