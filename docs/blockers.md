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
