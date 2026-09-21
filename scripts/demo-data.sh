#!/usr/bin/env bash
# make demo-data (FR-444, TC-469): realistic projects and tasks for one account, made through the
# public API, so it works on any environment (local, staging or production).
#   SITE_URL        the frontend address
#   DEMO_EMAIL, DEMO_PASSWORD   the account to fill (created if it does not exist)
# Run it against a fresh account: it adds three projects each time.
set -euo pipefail
: "${SITE_URL:?Set SITE_URL}"; : "${DEMO_EMAIL:?Set DEMO_EMAIL}"; : "${DEMO_PASSWORD:?Set DEMO_PASSWORD}"
SITE_URL="${SITE_URL%/}"; B="$SITE_URL/api/bff"; J="$(mktemp)"; trap 'rm -f "$J"' EXIT
O="Origin: $SITE_URL"; C="Content-Type: application/json"
api() { curl -sf -b "$J" -c "$J" -H "$O" -H "$C" "$@"; }
jq_() { python3 -c "import json,sys;print(json.load(sys.stdin)$1)"; }
in_days() { date -u -d "+$1 days" +%F; }

curl -s -o /dev/null -X POST "$B/users" -H "$O" -H "$C" -d "{\"name\":\"Demo User\",\"email\":\"$DEMO_EMAIL\",\"password\":\"$DEMO_PASSWORD\"}" || true
api -o /dev/null -X POST "$B/auth/login" -d "{\"email\":\"$DEMO_EMAIL\",\"password\":\"$DEMO_PASSWORD\"}"
ME="$(api "$B/auth/me" | jq_ "['id']")"

project() { api -X POST "$B/projects" -d "{\"name\":\"$1\",\"description\":\"$2\",\"status\":\"$3\",\"dueDate\":\"$(in_days "$4")\"}" | jq_ "['id']"; }
task() { # project title priority due-days status [assign]
  local body="{\"projectId\":\"$1\",\"title\":\"$2\",\"priority\":\"$3\",\"dueDate\":\"$(in_days "$4")\"$([ "${6:-}" = assign ] && echo ",\"assigneeId\":\"$ME\"")}"
  local id; id="$(api -X POST "$B/tasks" -d "$body" | jq_ "['id']")"
  case "$5" in
    in_progress) api -o /dev/null -X PATCH "$B/tasks/$id/status" -d '{"status":"in_progress"}';;
    in_review)   for s in in_progress in_review; do api -o /dev/null -X PATCH "$B/tasks/$id/status" -d "{\"status\":\"$s\"}"; done;;
    done)        for s in in_progress in_review done; do api -o /dev/null -X PATCH "$B/tasks/$id/status" -d "{\"status\":\"$s\"}"; done;;
  esac
}

P1="$(project "Website relaunch" "Move the marketing site to the new design system." active 45)"
task "$P1" "Audit the current pages and analytics" medium -3 done assign
task "$P1" "Write the new homepage copy" high 4 in_progress assign
task "$P1" "Build the pricing page" high 9 todo
task "$P1" "Accessibility review with a screen reader" urgent 12 todo assign
task "$P1" "Redirect map for the old URLs" medium 15 in_review

P2="$(project "Mobile app v2" "Second release of the customer app." active 90)"
task "$P2" "Design the three onboarding screens" high 6 in_progress assign
task "$P2" "Offline mode for saved items" medium 25 todo
task "$P2" "Crash reporting and alerts" low 20 todo

P3="$(project "Customer onboarding" "A welcome flow that gets people to their first result." planned 60)"
task "$P3" "Interview five new customers" medium 10 todo assign
task "$P3" "Draft the welcome email series" low 18 todo

echo "Created 3 projects and 10 tasks for $DEMO_EMAIL"
