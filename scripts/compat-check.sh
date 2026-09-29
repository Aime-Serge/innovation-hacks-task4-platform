#!/usr/bin/env bash
# TC-456 (NFR-408): the PREVIOUS API release keeps working on the newly migrated schema.
# It takes the backend of the baseline tag (Task 3, before any Task 4 change), adds only the
# Task 4 migrations to it, and runs that release's own API tests on PostgreSQL. A release that
# breaks on the additive schema fails here, before a deploy could.
#   BASE_TAG   the previous release (default task-3-baseline)
set -euo pipefail
cd "$(dirname "$0")/.."
BASE_TAG="${BASE_TAG:-task-3-baseline}"
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
git archive "$BASE_TAG" backend | tar -x -C "$WORK"
cp backend/migrations/versions/000[567]_*.py "$WORK/backend/migrations/versions/"
echo "Previous release: $BASE_TAG; migrations now: $(ls "$WORK/backend/migrations/versions" | grep -c '^0')"
# The release's hygiene tests ask git which files are tracked, so the copy needs to be a repository.
(cd "$WORK" && git init -q && git add -A)
cd "$WORK/backend"
unset VIRTUAL_ENV
# Only the tests of the release's behaviour: its API and business rules. The catalogue tests that
# list the exact tables, columns and constraints describe the old schema and change with it.
uv run --frozen pytest -q --no-cov --backend sql tests/api tests/security -p no:cacheprovider
