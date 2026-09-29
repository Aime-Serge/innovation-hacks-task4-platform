#!/usr/bin/env bash
# Verifies the developer/team-lead role feature (feat/role-alignment) against the pack's
# hard rules: no permission-code drift, no surprise migrations, the scope actually differs
# by role, and both gates are green. See docs/role-alignment-contract.md.
set -uo pipefail
cd "$(dirname "$0")/.."

BASE="${ROLE_ALIGN_BASE:-028a8ba42df3daf427d3ce0f90c4890dc03d8a69}"
pass=0
fail=0

check() {
  local name="$1" ok="$2" detail="$3"
  if [ "$ok" -eq 0 ]; then
    echo "PASS  $name"
    pass=$((pass + 1))
  else
    echo "FAIL  $name"
    [ -n "$detail" ] && echo "      $detail"
    fail=$((fail + 1))
  fi
}

echo "== V1: permission/authz code untouched =="
V1_DIFF=$(git diff "$BASE" --stat -- \
  backend/app/services/authz.py \
  backend/app/services/visibility.py \
  frontend/src/lib/session 2>&1)
check "V1 authz/visibility files untouched" "$([ -z "$V1_DIFF" ] && echo 0 || echo 1)" "$V1_DIFF"

echo "== V2: at most the justified migration count =="
V2_COUNT=$(git diff "$BASE" --name-only -- backend/migrations | grep -c . || true)
check "V2 zero new migrations (indexes already sufficient)" "$([ "$V2_COUNT" -eq 0 ] && echo 0 || echo 1)" "found $V2_COUNT migration file(s) changed"

echo "== V3: dashboard scope actually differs by role (existing BR-401 coverage) =="
cd backend
V3_OUT=$(script -qec "uv run pytest tests/security/test_isolation.py tests/api/test_platform.py::test_tc319_dashboard_summary_counts -q" /dev/null 2>&1)
V3_STATUS=$?
cd ..
check "V3 isolation + dashboard summary tests pass" "$V3_STATUS" "$(echo "$V3_OUT" | tail -5)"

echo "== V4: one DashboardView for both roles (no forked component) =="
V4_COUNT=$(find frontend/src -iname "DashboardView*.tsx" -not -path "*/node_modules/*" | grep -v ".test." | wc -l)
check "V4 exactly one DashboardView component" "$([ "$V4_COUNT" -eq 1 ] && echo 0 || echo 1)" "found $V4_COUNT files"

echo "== V5: backend gate (lint, typecheck, layers, test, spec) =="
cd backend
V5_OUT=$(script -qec "make lint typecheck layers spec-check spec-diff test" /dev/null 2>&1)
V5_STATUS=$?
cd ..
check "V5 backend gate" "$V5_STATUS" "$(echo "$V5_OUT" | tail -15)"

echo "== V6: frontend role tests (RT-01..07 equivalents) =="
cd frontend
V6_OUT=$(script -qec "npx vitest run tests/unit/register-wizard.test.tsx tests/unit/dashboard.test.tsx" /dev/null 2>&1)
V6_STATUS=$?
cd ..
check "V6 frontend role tests" "$V6_STATUS" "$(echo "$V6_OUT" | tail -10)"

echo
echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
