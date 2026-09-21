# Baseline audit (Phase 0): Task 2

Audit of `main` at commit `6a94672`, before the rebuild on `task/2-backend`,
against `docs/standards/task2-standards-pack.md`.

## What exists

A small FastAPI service (about 1,300 lines): in-memory users, projects and tasks,
unversioned routes (`/users`, `/projects`, `/tasks`), a landing page at `/`, 48
tests, deployed on Render (free tier).

## What conforms

Pydantic v2 models; an error handler with a consistent envelope; settings read from
the environment; `.env` ignored by git; `.env.example`; a Render blueprint.

## What conflicts, and what the rebuild does

| # | Finding | Pack item | Action |
| --- | --- | --- | --- |
| 1 | No authentication or authorization; every route is open | FR-203, FR-204, FR-223, TH-201, TH-202 | JWT login, roles, one authorization layer |
| 2 | No password handling | FR-202, NFR-212 | argon2id in a thread pool, 12 to 128 character policy |
| 3 | Routes are unversioned | FR-230, NFR-221 | `/api/v1`, health at `/healthz` and `/readyz` |
| 4 | Storage and rules mixed in routers and one repository per file at the top level | Section 7, NFR-209 | api, services, repository protocols, memory implementations, import-linter contract |
| 5 | Status is a free field; no workflow | FR-219, BR-204, BR-211 | Workflow table and dedicated endpoint |
| 6 | No pagination, sorting or filters on lists | FR-211, FR-216, FR-229 | Common list contract |
| 7 | Error envelope lacks `details` and `requestId`; not every error class is covered (400, 405, 413, 415) | FR-224, FR-232 | Central handlers for all classes |
| 8 | No request ids, JSON logs, security headers, body limit, rate limit | NFR-213 to NFR-217 | Middleware and limiter |
| 9 | Settings not validated at startup; `SECRET_KEY` optional | FR-227, NFR-223 | Fail-fast settings that name the variable |
| 10 | No `mypy --strict`, ruff, import-linter, coverage gate, security scans | NFR-206 to NFR-211 | Tooling and `make gate` |
| 11 | Python 3.14 pin | Section 7 stack | Python 3.12 via uv |
| 12 | No OpenAPI export, drift check, Postman collection | FR-228, NFR-219, NFR-221 | Export, drift check, generated collection |
| 13 | `GET /` landing page is not a documented route | TH-209, FR-230 | Removed (ADR-215) |
| 14 | 48 tests cover a different API | Section 10 | Replaced by the TC-numbered suite |

## Consequence

The rebuild is not backward compatible with the deployed API (ADR-214). Nothing
outside this repository calls it yet, so the live Render service changes only when
the branch is merged.
