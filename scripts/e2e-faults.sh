#!/usr/bin/env bash
# TC-448: restart the API with each fault, and run the matching browser checks against the stack.
# Needs the compose stack up (make up) and the site on http://localhost:3000.
set -euo pipefail
cd "$(dirname "$0")/.."
export LIVE_URL="${LIVE_URL:-http://localhost:3000}"

run() { # name, then KEY=VALUE settings for the API
  local name="$1"; shift
  echo "== fault: $name ($*)"
  env "$@" RATE_LIMIT_ATTEMPTS=500 docker compose up -d --force-recreate api >/dev/null 2>&1
  for _ in $(seq 1 30); do curl -fs localhost:8000/readyz >/dev/null 2>&1 && break; sleep 1; done
  (cd frontend && FAULT="$name" npx playwright test tests/live/faults.spec.ts --project=live --workers=1 2>&1 | grep -E "passed|failed|✓|✘|Error" || true)
}

run ai-off AI_ENABLED=false
run provider-timeout FAKE_LLM_SCENARIO=timeout
run bad-json FAKE_LLM_SCENARIO=bad_json
run quota AI_DAILY_LIMIT_PER_USER=1
run injection FAKE_LLM_SCENARIO=injection_echo
echo "== restoring the normal stack"
RATE_LIMIT_ATTEMPTS=200 docker compose up -d --force-recreate api >/dev/null 2>&1
