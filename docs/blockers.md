# Blockers and open items

| ID | Item | Status | Next step |
|---|---|---|---|
| B-401 | Task 1 frontend baseline is red: TC-090 (NFR-04) first-load JavaScript is 188 to 190 KB gzip per route against 170 KB (was about 183 KB when imported) | Open. Not fixed; the budget is not raised | Measured on 2026-09-21: about 150 KB is React and the Next runtime and cannot shrink; the app's own share is about 65 KB (i18n dictionary about 14 KB, TanStack Query about 14 KB, zod and the schemas about 18 KB, the rest components). The mock adapter is already excluded from HTTP builds (checked: no fixture text in the chunks). Candidates: split the i18n dictionary so the AI and profile strings load with their screens; parse API answers lazily; drop unused Query features. Needs about 18 KB. Do this before the final gate |
| B-402 | `mypy --strict` exits 120 when stdout is not a terminal in this harness | Worked around, not a code fault | Run gates under `script -qec "make gate" /dev/null` here; a normal terminal is unaffected |
| B-403 | The HTTP adapter reads up to 1000 projects, tasks or users per list and the screens filter the whole list | Accepted limit (ADR-425) | Add server-side paging to the list screens if a team outgrows it |
| B-404 | Task 1 screens for password reset, password and email change, avatar upload and account deletion have no API behind them | Out of scope (section 2); the adapter answers `NOT_SUPPORTED` | Hide or explain these screens in the Phase 6 polish |

## B-F1 (found in the final baseline, 2026-09-21)
- schemathesis contract test on `POST /ai/projects/{projectId}/task-suggestions` fails at baseline (undocumented 400 for a NUL byte body).
- Prettier style failures in 3 frontend e2e test files at baseline.
Neither is caused by the minimal profile work. Status: open.

## B-F2 (2026-09-21, T+72 min): frontend phase not started
The T+75 rule stopped new work before Phase 2 (types) and Phase 3 (frontend). Consequences, all open:
- `frontend/src/generated/api-types.ts` is not regenerated, so `npm run check:api` will fail against the new `backend/docs/openapi.json`.
- The registration form, mock adapter (S-D), avatar menu (S-C), profile pages, settings, people picker and dashboard banner are unchanged.
- The current frontend registration posts `name`, which the new `POST /users` rejects (S-A). Do not deploy the API without the frontend work.
- MT-01 (UI part), MT-06 UI, MT-10, MT-11, MT-16, MT-19, MT-23 not done.

## B-F3 (2026-09-22): gitleaks history leak needs a decision only the author can make
`backend/scripts/ai_eval.py:164` in commit fc2179d contains the literal `evaluation-pass-1`
(a throwaway in-memory evaluator password, not a real credential). The current working tree no
longer contains it (fixed in 53c61d7, which now generates the password at runtime), but gitleaks
scans full history and the old commit still has it, so `make guide-check` / `security-full` still
report 1 leak.
Fixing it in history needs `git filter-repo --replace-text`, a destructive rewrite that changes
every commit hash after fc2179d. The harness blocks destructive git rewrites from me by policy.
Nothing has been pushed, so a rewrite is safe to run by hand:
  git filter-repo --force --replace-text <(echo 'evaluation-pass-1==>REDACTED')
Author decision needed: run that rewrite, or accept the history leak as a documented, non-secret
false positive (G-40 marked Partial with this note) and move on.
