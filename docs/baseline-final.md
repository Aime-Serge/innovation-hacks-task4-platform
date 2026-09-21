# Baseline before the minimal profile work (2026-09-21, branch feat/minimal-profile, base 4ee485b)

Commands were run on this machine; Docker was available, so the PostgreSQL-backed tests ran.

| Gate | Command | Result |
| --- | --- | --- |
| Backend tests (memory and PostgreSQL) | `cd backend && uv run --frozen pytest -q --no-cov` | 484 passed, 1 failed (430 s) |
| Frontend types | `npm run typecheck` | clean |
| Frontend unit tests | `npm run test` | 21 files, 343 tests passed |
| Frontend lint | `npm run lint` | FAILS: Prettier reports 3 files (tests/e2e/inp.spec.ts, tests/e2e/states.spec.ts and one more) |

## Failures that exist before any change in this work

1. `tests/contract/test_schemathesis.py::test_tc250_...[POST /api/v1/ai/projects/{projectId}/task-suggestions]`:
   the API answers an undocumented 400 (schemathesis sent a NUL byte body; documented codes are
   200, 401, 403, 404, 422, 503, 502, 429, 500).
2. Frontend Prettier style on 3 e2e test files.

Both are logged in docs/blockers.md. They are not caused by this work and are not hidden.

Not run in the baseline: Playwright e2e and live suites, Lighthouse, ruff/mypy summaries, security-full, deploy-check
(they need the compose stack or were not captured); they are re-run in Phase 5 and marked accordingly.

`docs/openapi.baseline-final.json` is a copy of `backend/docs/openapi.json` at this commit. No tags were created or moved
(existing tag: task-3-baseline).
