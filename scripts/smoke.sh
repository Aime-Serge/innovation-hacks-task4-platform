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
# NEEDS THE NEW ENDPOINTS (feat/minimal-profile, pack section 5, supersession S-A): registration now
# carries the profile block, consent and age confirmation. The field names follow the pack's user
# representation; confirm them against backend/docs/openapi.json once the backend is merged.
REG="{\"givenName\":\"Smoke\",\"familyName\":\"Test\",\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"profile\":{\"discipline\":\"backend\",\"seniority\":\"mid\",\"employmentStatus\":\"employed\",\"companyName\":\"Smoke Co\",\"jobTitle\":\"Engineer\",\"country\":\"GB\",\"timeZone\":\"UTC\"},\"termsAccepted\":true,\"ageConfirmed\":true}"
step "validate step 2 (creates nothing)" 200 -X POST "$B/users/validate" -H "$O" -H "$C" -d "$REG"
step "register with profile"         201 -X POST "$B/users" -H "$O" -H "$C" -d "$REG"
UID_="$(field "['id']" 2>/dev/null)"
step "log in"                        200 -c "$J" -X POST "$B/auth/login" -H "$O" -H "$C" -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}"
step "who am I"                      200 -b "$J" "$B/auth/me"
# NEEDS THE NEW ENDPOINTS: GET /me, PATCH /me/profile, the extended GET /users (professional summary).
step "read own profile"              200 -b "$J" "$B/me"
step "edit profile"                  200 -b "$J" -X PATCH "$B/me/profile" -H "$O" -H "$C" -d '{"headline":"Smoke test headline","about":"Created by scripts/smoke.sh"}'
step "people picker search"          200 -b "$J" "$B/users?q=Smoke&pageSize=20"
PICK="$(field "['items'][0]['id']" 2>/dev/null)"; PICK="${PICK:-$UID_}"   # the member chosen in the picker
step "create project"                201 -b "$J" -X POST "$B/projects" -H "$O" -H "$C" -d '{"name":"Smoke project"}'
PID="$(field "['id']" 2>/dev/null)"
step "assign task (picker choice)"    201 -b "$J" -X POST "$B/tasks" -H "$O" -H "$C" -d "{\"projectId\":\"$PID\",\"title\":\"Smoke task\",\"assigneeId\":\"$PICK\"}"
TID="$(field "['id']" 2>/dev/null)"
step "change status"                 200 -b "$J" -X PATCH "$B/tasks/$TID/status" -H "$O" -H "$C" -d '{"status":"in_progress"}'
step "dashboard"                     200 -b "$J" "$B/dashboard/summary"
step "AI status"                     200 -b "$J" "$B/ai/status"
step "delete task"                   204 -b "$J" -X DELETE "$B/tasks/$TID" -H "$O"
step "delete project"                204 -b "$J" -X DELETE "$B/projects/$PID" -H "$O"
# NEEDS THE NEW ENDPOINTS: POST /me/password (204; a wrong current password is 403 INVALID_CREDENTIALS).
# The site's server layer supplies the refresh token so this session survives (ADR-610); after the
# change the old password must no longer work, so we log in again with the new one.
NEWPASS="smoke-New-$RANDOM-$RANDOM"
step "wrong current password"        403 -b "$J" -X POST "$B/me/password" -H "$O" -H "$C" -d "{\"currentPassword\":\"not-the-password-123\",\"newPassword\":\"$NEWPASS\"}"
step "change password"               204 -b "$J" -c "$J" -X POST "$B/me/password" -H "$O" -H "$C" -d "{\"currentPassword\":\"$PASS\",\"newPassword\":\"$NEWPASS\"}"
step "log in with the new password"  200 -c "$J" -X POST "$B/auth/login" -H "$O" -H "$C" -d "{\"email\":\"$EMAIL\",\"password\":\"$NEWPASS\"}"
step "refresh session"               204 -b "$J" -c "$J" -X POST "$B/auth/refresh" -H "$O"
step "log out"                       204 -b "$J" -c "$J" -X POST "$B/auth/logout" -H "$O"
step "after logout: rejected"        401 -b "$J" "$B/auth/me"
step "foreign Origin refused"        403 -X POST "$B/projects" -H "Origin: https://evil.example" -H "$C" -d '{"name":"x"}'

P95="$(printf '%s\n' "${TIMES[@]}" | sort -n | awk '{a[NR]=$1} END {i=int(NR*0.95); if (i<1) i=1; printf "%.0f", a[i]*1000}')"
echo "p95 of $(( ${#TIMES[@]} )) calls: ${P95} ms (target 500 ms when warm, NFR-402)"
[ "$FAIL" = 0 ] && echo "SMOKE PASSED" || { echo "SMOKE FAILED"; exit 1; }
