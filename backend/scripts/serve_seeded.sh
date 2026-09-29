#!/usr/bin/env bash
# Start a seeded server for Newman, Schemathesis and Locust; print nothing but the PID file path.
# Usage: serve_seeded.sh <port> <profile> <pidfile>
set -euo pipefail
PORT="${1:?port}"; PROFILE="${2:-default}"; PIDFILE="${3:?pidfile}"
export STORAGE_BACKEND=memory LOG_LEVEL="${LOG_LEVEL:-warning}" APP_ENV=test SEED_PROFILE="$PROFILE" SEED_PASSWORD="${SEED_PASSWORD:-Seeded-Password-123}"
export SECRET_KEY="${SECRET_KEY:-$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')}"
export RATE_LIMIT_ATTEMPTS="${RATE_LIMIT_ATTEMPTS:-100000}"
uv run --frozen uvicorn app.main:create_app --factory --port "$PORT" --log-level warning &
echo $! > "$PIDFILE"
for _ in $(seq 1 60); do
  if curl -fs "http://127.0.0.1:$PORT/readyz" >/dev/null; then exit 0; fi
  sleep 0.5
done
echo "server did not become ready" >&2; kill "$(cat "$PIDFILE")" || true; exit 1
