#!/usr/bin/env bash
# Locust against the API on PostgreSQL with the xl profile (NFR-301, NFR-302).
# Needs the compose database up and migrated; it clears and reseeds that database.
set -euo pipefail
PORT="${1:-8123}"; PIDFILE="$(mktemp)"
trap 'kill "$(cat "$PIDFILE")" 2>/dev/null || true; rm -f "$PIDFILE"' EXIT
export SEED_PASSWORD="${SEED_PASSWORD:-Seeded-Password-123}"
uv run --frozen python -m app.seed --profile xl --reset --yes >/dev/null
# A freshly bulk-loaded table has no visibility map yet, which slows counts: vacuum it, as autovacuum would.
CONTAINER="$(docker compose -f database/docker-compose.yml --env-file .env ps -q db)"
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$CONTAINER" psql -U "${POSTGRES_USER:-ih_admin}" -d "${POSTGRES_DB:-ih_platform}" -qc "VACUUM (ANALYZE)"
export APP_ENV=test STORAGE_BACKEND=sql LOG_LEVEL=warning SEED_PROFILE=none RATE_LIMIT_ATTEMPTS=100000
uv run --frozen uvicorn app.main:create_app --factory --port "$PORT" --log-level warning &
echo $! > "$PIDFILE"
for _ in $(seq 1 60); do curl -fs "http://127.0.0.1:$PORT/readyz" >/dev/null && break; sleep 0.5; done
LOAD_PASSWORD="$SEED_PASSWORD" uv run --frozen locust -f tests/load/locustfile.py \
  --headless --reset-stats -u "${LOAD_USERS:-3}" -r 10 -t 40s --host "http://127.0.0.1:$PORT" --csv /tmp/devdash-load-sql --only-summary
