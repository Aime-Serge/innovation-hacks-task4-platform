# Baseline before Task 4 (Phase 0)

Run on 2026-09-21 from the source repositories, before anything was moved into this monorepo. Task 3 already contains Task 2's behaviour, so its gate covers both.

## Task 2 and Task 3 API: `make gate` (Task 3 repo, branch task/3-standards-pack)

**Result: pass (exit 0).**

| Stage | Result |
|---|---|
| lint, typecheck (`mypy --strict`, 104 files), layers | pass |
| test | 280 passed, coverage 96.35% (threshold 90%) |
| spec-check | 24 operations, 0 gaps |
| contract, security (bandit, gitleaks: 52 commits, no leaks), postman, load | pass |
| db-gate, SQL backend suite | 256 passed (24 deselected) |

Environment note: in this shell `mypy --strict` exits 120 when stdout is not a terminal (the "Success" summary line fails to flush), so the gate was run through `script -qec "make gate" /dev/null`. The check itself is unchanged; the same mypy run under a pseudo-terminal reports no issues.

## Task 1 frontend: `npm run gate` (Task 1 repo)

**Result: fail (exit 1). Baseline is red.**

Passed: typecheck, lint, no-JavaScript check, unit tests, and 134 end-to-end tests (6 skipped by design). Failed: 6 tests, all TC-090 (NFR-04), one per route, because the first-load JavaScript is about 183 KB gzip against a 170 KB budget (received 187773 bytes on `/`, budget 174080). The later gate stages (a11y, Lighthouse, audit, build) did not run because the chain stops at the first failure.

Per the Task 4 rules this is fixed first, in its own `fix(web)` commit, when the frontend is imported; the budget is not raised.
