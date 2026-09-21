# Blockers and open items

| ID | Item | Status | Next step |
|---|---|---|---|
| B-401 | Task 1 frontend baseline is red: TC-090 (NFR-04) first-load JavaScript is about 183 KB gzip against 170 KB on all six routes | Open. Not fixed yet; the budget is not raised | Find what grew (likely the later profile and password-reset code), split or lazy-load it, rerun `npm run gate`. Owner: Phase 5, before the frontend work |
| B-402 | `mypy --strict` exits 120 when stdout is not a terminal in this harness | Worked around, not a code fault | Run gates under `script -qec "make gate" /dev/null` here; a normal terminal is unaffected |
| B-403 | The HTTP adapter reads up to 1000 projects, tasks or users per list and the screens filter the whole list | Accepted limit (ADR-425) | Add server-side paging to the list screens if a team outgrows it |
| B-404 | Task 1 screens for password reset, password and email change, avatar upload and account deletion have no API behind them | Out of scope (section 2); the adapter answers `NOT_SUPPORTED` | Hide or explain these screens in the Phase 6 polish |
