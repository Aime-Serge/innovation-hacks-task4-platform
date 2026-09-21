#!/usr/bin/env bash
# The smoke test (FR-440, NFR-402, TC-457): the whole journey through the site, with timings.
#   SITE_URL   the frontend's address, e.g. https://app.example.com
# It registers a throwaway account, so it needs registration switched on. It removes the task and
# project it creates. Exit code 0 means every step passed.
set -uo pipefail
: "${SITE_URL:?Set SITE_URL to the frontend address}"
SITE_URL="${SITE_URL%/}"; B="$SITE_URL/api/bff"; J="$(mktemp)"; trap 'rm -f "$J"' EXIT
O="Origin: $SITE_URL"; C="Content-Type: application/json"
FAIL=0; TIMES=()
step() { # name, expected-status, curl args...
  local name="$1" want="$2"; shift 2
  local out; out="$(curl -s -o /tmp/smoke-body -w '%{http_code} %{time_total}' "$@")"
  local code="${out% *}" secs="${out#* }"
  TIMES+=("$secs")
  if [ "$code" = "$want" ]; then printf 'ok   %-34s %s  %.0f ms\n' "$name" "$code" "$(echo "$secs*1000" | bc -l)"
  else printf 'FAIL %-34s got %s, wanted %s\n' "$name" "$code" "$want"; FAIL=1; fi
}
field() { python3 -c "import json,sys;print(json.load(open('/tmp/smoke-body'))$1)"; }
EMAIL="smoke-$(date +%s)-$RANDOM@example.com"; PASS="smoke-Pass-$RANDOM-$RANDOM"

step "login page renders"            200 "$SITE_URL/login"
step "protected page redirects"      307 -o /dev/null --max-redirs 0 "$SITE_URL/projects"
step "register"                      201 -X POST "$B/users" -H "$O" -H "$C" -d "{\"name\":\"Smoke\",\"email\":\"$EMAIL\",\"password\":\"$PASS\"}"
UID_="$(field "['id']" 2>/dev/null)"
step "log in"                        200 -c "$J" -X POST "$B/auth/login" -H "$O" -H "$C" -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}"
step "who am I"                      200 -b "$J" "$B/auth/me"
step "create project"                201 -b "$J" -X POST "$B/projects" -H "$O" -H "$C" -d '{"name":"Smoke project"}'
PID="$(field "['id']" 2>/dev/null)"
step "create and assign task"        201 -b "$J" -X POST "$B/tasks" -H "$O" -H "$C" -d "{\"projectId\":\"$PID\",\"title\":\"Smoke task\",\"assigneeId\":\"$UID_\"}"
TID="$(field "['id']" 2>/dev/null)"
step "change status"                 200 -b "$J" -X PATCH "$B/tasks/$TID/status" -H "$O" -H "$C" -d '{"status":"in_progress"}'
step "dashboard"                     200 -b "$J" "$B/dashboard/summary"
step "AI status"                     200 -b "$J" "$B/ai/status"
step "delete task"                   204 -b "$J" -X DELETE "$B/tasks/$TID" -H "$O"
step "delete project"                204 -b "$J" -X DELETE "$B/projects/$PID" -H "$O"
step "refresh session"               204 -b "$J" -c "$J" -X POST "$B/auth/refresh" -H "$O"
step "log out"                       204 -b "$J" -c "$J" -X POST "$B/auth/logout" -H "$O"
step "after logout: rejected"        401 -b "$J" "$B/auth/me"
step "foreign Origin refused"        403 -X POST "$B/projects" -H "Origin: https://evil.example" -H "$C" -d '{"name":"x"}'

P95="$(printf '%s\n' "${TIMES[@]}" | sort -n | awk '{a[NR]=$1} END {i=int(NR*0.95); if (i<1) i=1; printf "%.0f", a[i]*1000}')"
echo "p95 of $(( ${#TIMES[@]} )) calls: ${P95} ms (target 500 ms when warm, NFR-402)"
[ "$FAIL" = 0 ] && echo "SMOKE PASSED" || { echo "SMOKE FAILED"; exit 1; }
