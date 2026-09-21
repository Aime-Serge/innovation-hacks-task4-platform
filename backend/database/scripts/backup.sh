#!/usr/bin/env bash
# A compressed logical dump, written outside the repository (FR-324). The dump holds password hashes
# and personal data, so treat it as a secret: keep it private and encrypt it at rest.
# Usage: MIGRATION_DATABASE_URL=... database/scripts/backup.sh [output-dir]
set -euo pipefail
: "${BACKUP_DATABASE_URL:?Set BACKUP_DATABASE_URL (a libpq URL for a role that can read everything)}"
DIR="${1:-${BACKUP_DIR:-$HOME/.devdash-backups}}"
umask 077
mkdir -p "$DIR"
FILE="$DIR/devdash-$(date -u +%Y%m%dT%H%M%SZ).dump"
pg_dump --format=custom --compress=9 --no-owner --dbname "$BACKUP_DATABASE_URL" --file "$FILE"
echo "$FILE"
