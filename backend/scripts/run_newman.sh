#!/usr/bin/env bash
# Run the Postman collection against a throwaway seeded server (NFR-222).
set -euo pipefail
PORT="${1:-8123}"; PIDFILE="$(mktemp)"
trap 'kill "$(cat "$PIDFILE")" 2>/dev/null || true; rm -f "$PIDFILE"' EXIT
PASSWORD="Seeded-Password-123"
SEED_PASSWORD="$PASSWORD" ./scripts/serve_seeded.sh "$PORT" default "$PIDFILE"
${NEWMAN:-npx --yes newman@6} run postman/devdash.postman_collection.json \
  -e postman/devdash.postman_environment.json \
  --env-var "baseUrl=http://127.0.0.1:$PORT" --env-var "leadPassword=$PASSWORD" \
  --reporters cli
