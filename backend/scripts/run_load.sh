#!/usr/bin/env bash
# Locust against the "large" seed profile; fails when the thresholds in tests/load/locustfile.py break (NFR-201).
set -euo pipefail
PORT="${1:-8123}"; PIDFILE="$(mktemp)"
trap 'kill "$(cat "$PIDFILE")" 2>/dev/null || true; rm -f "$PIDFILE"' EXIT
SEED_PASSWORD="Seeded-Password-123" ./scripts/serve_seeded.sh "$PORT" large "$PIDFILE"
LOAD_PASSWORD="Seeded-Password-123" uv run --frozen locust -f tests/load/locustfile.py \
  --headless -u 20 -r 10 -t 20s --host "http://127.0.0.1:$PORT" \
  --csv /tmp/devdash-load --only-summary
