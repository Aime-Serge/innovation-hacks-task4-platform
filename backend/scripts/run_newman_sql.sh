#!/usr/bin/env bash
# The Postman collection against the API on PostgreSQL (TC-312, F8). Clears and reseeds the compose DB.
set -euo pipefail
PORT="${1:-8123}"; PIDFILE="$(mktemp)"
trap 'kill "$(cat "$PIDFILE")" 2>/dev/null || true; rm -f "$PIDFILE"' EXIT
PASSWORD="Seeded-Password-123"
export SEED_PASSWORD="$PASSWORD"
uv run --frozen python -m app.seed --profile default --reset --yes >/dev/null
export APP_ENV=test STORAGE_BACKEND=sql LOG_LEVEL=warning SEED_PROFILE=none RATE_LIMIT_ATTEMPTS=100000
uv run --frozen uvicorn app.main:create_app --factory --port "$PORT" --log-level warning &
echo $! > "$PIDFILE"
for _ in $(seq 1 60); do curl -fs "http://127.0.0.1:$PORT/readyz" >/dev/null && break; sleep 0.5; done
uv run --frozen python scripts/build_postman.py >/dev/null
${NEWMAN:-npx --yes newman@6} run postman/devdash.postman_collection.json \
  -e postman/devdash.postman_environment.json \
  --env-var "baseUrl=http://127.0.0.1:$PORT" --env-var "leadPassword=$PASSWORD" --reporters cli
