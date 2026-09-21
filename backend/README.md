# DevDash API: users, projects and tasks, on PostgreSQL

Task 3 of the Innovation Hacks Full Stack Development Internship: the Task 2 API with its in-memory
storage replaced by **PostgreSQL 16**, built to the _Persistent Data Layer Engineering Standards
Pack (Task 3)_. The API contract is unchanged, so the Task 1 dashboard and every Task 2 test keep
working. The backend is **FastAPI**, built to the _Users, Projects & Tasks API Engineering Standards Pack
(Task 2)_. Twenty-three documented operations under `/api/v1`, one error envelope, bearer-token
authentication, business rules enforced on the server, and a test gate that fails the build when
the code, the tests or the OpenAPI document drift apart.

![Python 3.12](https://img.shields.io/badge/python-3.12-3776ab) ![mypy strict](https://img.shields.io/badge/mypy-strict-2a6db2) ![FastAPI](https://img.shields.io/badge/FastAPI-Pydantic_v2-009688)

- **Live API:** _add the Render URL after deploying_ (see [Deploying](#deploying))
- **Previous live API (Task 2):** https://ih-task2-api.onrender.com ([docs](https://ih-task2-api.onrender.com/docs)). The free tier sleeps, so the first request can take about a minute. It is seeded demo data that resets on restart (see [Deploying](#deploying))
- **Interactive docs:** `/docs` (Swagger UI), on in development, off in production
- **Demo video:** _add the link after recording, see [DEMO_SCRIPT.md](DEMO_SCRIPT.md)_
- **Standards:** [docs/standards/](docs/standards/) · **Decisions:** [docs/adr/](docs/adr/) ·
  **Task 1 compatibility:** [docs/compatibility-task1.md](docs/compatibility-task1.md)

## Tour

| | |
| --- | --- |
| ![Welcome page at the service root](docs/screenshots/01-welcome.png) **Welcome page** (`GET /`): what the service is, links to the docs and a three-call example | ![Swagger UI operation list](docs/screenshots/02-swagger-overview.png) **Interactive docs** (`/docs`): every operation grouped by resource, generated from the code |

![Swagger UI showing a 409 INVALID_STATUS_TRANSITION response](docs/screenshots/03-invalid-transition-409.png)

**A business rule in action.** In Swagger UI, `PATCH /api/v1/tasks/{taskId}/status` with
`{"status": "done"}` on a task that is still `todo` returns `409 INVALID_STATUS_TRANSITION`. The
error names the statuses that are allowed (`in_progress`), and carries a `requestId` that matches the
`X-Request-ID` header and the server log. The security headers are visible too. The screenshots come
from a local run with seeded demo data.

## Run it (3 commands)

You need [uv](https://docs.astral.sh/uv/) (it installs Python 3.12 for you).

```bash
uv sync --frozen                                                                 # 1. install
export SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')  # 2. configure
SEED_PROFILE=default uv run uvicorn app.main:create_app --factory --reload       # 3. run, with demo data
```

Open http://127.0.0.1:8000/docs. With `SEED_PROFILE=default` and no `SEED_PASSWORD`, a random
password for the seeded accounts is printed once to the console at startup (the lead is
`amara.diallo@example.com`). Nothing has a default credential. To keep settings in a file instead,
copy `.env.example` to `.env` and fill in `SECRET_KEY`.

## Configuration

Every setting comes from the environment and is validated at startup. A missing or invalid value
stops the app and names the variable. `.env.example` is the source of truth and a test fails if a
setting is missing from it.

| Variable | Default | Meaning |
| --- | --- | --- |
| `APP_ENV` | `development` | `development`, `test` or `production`. Production turns Swagger UI off and adds HSTS. |
| `HOST` | `127.0.0.1` | Bind address. The Docker image binds `0.0.0.0`. |
| `PORT` | `8000` | Port. |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warning` or `error`. |
| `SECRET_KEY` | required | JWT signing key, at least 32 bytes. |
| `JWT_ISSUER` | `devdash-api` | `iss` claim, checked on every request. |
| `JWT_AUDIENCE` | `devdash-clients` | `aud` claim, checked on every request. |
| `ACCESS_TOKEN_TTL_SECONDS` | `900` | Token lifetime (60 to 86400). |
| `CORS_ORIGINS` | empty | Comma-separated allowed origins. A wildcard is refused. |
| `DOCS_ENABLED` | empty | Empty means on in development, off in production. |
| `MAX_BODY_BYTES` | `1048576` | Request body limit (413 above it). |
| `REQUEST_TIMEOUT_SECONDS` | `30` | Per-request timeout. |
| `RATE_LIMIT_ATTEMPTS` | `5` | Login and registration attempts allowed per window. |
| `RATE_LIMIT_WINDOW_SECONDS` | `60` | The window. |
| `ARGON2_TIME_COST` | `3` | argon2id time cost. Lower only in tests. |
| `ARGON2_MEMORY_KIB` | `65536` | argon2id memory cost. Lower only in tests. |
| `SEED_PROFILE` | `none` | `none`, `default`, `empty` or `large`. Refused when `APP_ENV=production`. |
| `SEED_PASSWORD` | empty | Password for seeded accounts; empty prints a random one. |
| `STORAGE_BACKEND` | `memory` | `sql` (PostgreSQL) or `memory`. Production refuses `memory`. |
| `DATABASE_URL` | empty | Application role connection, `postgresql+asyncpg://ih_app:<set-me>@host:5432/db`. Production needs `?ssl=require`. |
| `MIGRATION_DATABASE_URL` | empty | Migration role connection, used only by `make db-migrate`. |
| `DB_POOL_SIZE` | `10` | Connections kept in the pool. |
| `DB_MAX_OVERFLOW` | `10` | Extra connections allowed under load. |
| `DB_POOL_TIMEOUT_S` | `5` | Seconds to wait for a connection before answering 503. |
| `DB_STATEMENT_TIMEOUT_MS` | `5000` | Longest a query may run. |
| `DB_LOCK_TIMEOUT_MS` | `2000` | Longest a query may wait for a lock. |
| `DB_IDLE_TX_TIMEOUT_MS` | `10000` | Idle-in-transaction limit. |
| `DB_SLOW_QUERY_MS` | `200` | Queries slower than this are logged (fingerprint and duration only). |

## Try it: authentication walkthrough

```bash
BASE=http://127.0.0.1:8000
# 1. Register (public). New accounts are always developers.
curl -s -X POST $BASE/api/v1/users -H 'Content-Type: application/json' \
  -d '{"name":"Ada Lovelace","email":"ada@example.com","password":"correct-horse-battery"}'

# 2. Log in and keep the token.
TOKEN=$(curl -s -X POST $BASE/api/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"ada@example.com","password":"correct-horse-battery"}' | python3 -c 'import sys,json; print(json.load(sys.stdin)["accessToken"])')

# 3. Who am I?
curl -s $BASE/api/v1/auth/me -H "Authorization: Bearer $TOKEN"
```

Tokens last 15 minutes. An unknown email and a wrong password give the same `401
INVALID_CREDENTIALS`. Login and registration are rate limited (429 with `Retry-After`).

## Endpoints

Every route except registration, login and the health checks needs `Authorization: Bearer <token>`.
JSON is camelCase, ids are UUIDs, dates are ISO 8601, and lists take `page`, `pageSize` (1 to 100)
and `sort` (`field`, or `-field` for descending).

| Method | Path | Who | What |
| --- | --- | --- | --- |
| POST | `/api/v1/auth/login` | public | Exchange credentials for a token |
| GET | `/api/v1/auth/me` | any user | The current user |
| POST | `/api/v1/users` | public | Register (201 + `Location`) |
| GET | `/api/v1/users` | any user | List, search `q`, filter `role` |
| GET | `/api/v1/users/{userId}` | any user | One user |
| PATCH | `/api/v1/users/{userId}` | self or lead | Name, avatar, preferences; role by a lead only |
| DELETE | `/api/v1/users/{userId}` | lead | 204; 409 for the last lead or an owner of projects |
| GET | `/api/v1/projects` | any user | List, filter `status`, `ownerId`, search `q` |
| POST | `/api/v1/projects` | any user | Create; you become the owner |
| GET | `/api/v1/projects/{projectId}` | any user | One project with progress |
| PATCH | `/api/v1/projects/{projectId}` | owner or lead | Partial update |
| DELETE | `/api/v1/projects/{projectId}` | owner or lead | 204; 409 while it has tasks |
| GET | `/api/v1/projects/{projectId}/tasks` | any user | The project's tasks, same filters as `/tasks` |
| GET | `/api/v1/tasks` | any user | Filter `status`, `priority`, `projectId`, `assigneeId`, `overdue`, `dueBefore`, `dueAfter`, `q` |
| POST | `/api/v1/tasks` | project owner or lead | Create (status starts as `todo`) |
| GET | `/api/v1/tasks/{taskId}` | any user | One task |
| PATCH | `/api/v1/tasks/{taskId}` | owner, assignee or lead | Edit fields (not status) |
| PATCH | `/api/v1/tasks/{taskId}/status` | owner, assignee or lead | Move through the workflow |
| DELETE | `/api/v1/tasks/{taskId}` | owner or lead | 204 |
| GET | `/api/v1/activity` | any user | Recent activity, newest first; `limit` is the page size |
| GET | `/api/v1/dashboard/summary` | any user | Counts, completion rate and deadlines in the next 7 days |
| GET | `/` | public | Welcome page (HTML) |
| GET | `/healthz` | public | Liveness |
| GET | `/readyz` | public | Readiness (503 when a dependency is down) |

Task status workflow: `todo` → `in_progress` → `in_review` → `done`, with `in_review` → `in_progress`
and `done` → `in_progress` to reopen. Anything else is `409 INVALID_STATUS_TRANSITION`, and the
error lists the statuses that are allowed.

```bash
PROJECT=$(curl -s -X POST $BASE/api/v1/projects -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"name":"Atlas API Gateway","dueDate":"2026-12-01"}')
PID=$(echo "$PROJECT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["id"])')

TASK=$(curl -s -X POST $BASE/api/v1/tasks -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d "{\"projectId\":\"$PID\",\"title\":\"Write the migration plan\",\"priority\":\"high\"}")
TID=$(echo "$TASK" | python3 -c 'import sys,json; print(json.load(sys.stdin)["id"])')

curl -s -X PATCH $BASE/api/v1/tasks/$TID/status -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"status":"in_progress"}'
curl -s "$BASE/api/v1/tasks?status=in_progress&sort=-dueDate&pageSize=5" -H "Authorization: Bearer $TOKEN"
curl -s $BASE/api/v1/dashboard/summary -H "Authorization: Bearer $TOKEN"
```

## Errors

Every error, including framework errors (unknown route, wrong method, bad JSON), has one shape:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "One or more fields are invalid.",
             "details": [{ "field": "title", "message": "Must be between 1 and 120 characters." }],
             "requestId": "8f0c2e4a-3b1d-4f6e-9a57-2d7c1e9b5a10" } }
```

`requestId` matches the `X-Request-ID` response header (send your own to trace a call). Stack
traces and internals never appear in a response.

| Status | Code | When |
| --- | --- | --- |
| 400 | `MALFORMED_REQUEST` | The body is not valid JSON |
| 401 | `UNAUTHENTICATED` | Missing, malformed, expired or forged token |
| 401 | `INVALID_CREDENTIALS` | Wrong email or password (identical for both) |
| 403 | `FORBIDDEN` | Authenticated but not allowed |
| 404 | `NOT_FOUND` | Unknown id or route |
| 405 | `METHOD_NOT_ALLOWED` | Wrong method; `Allow` lists the right ones |
| 409 | `EMAIL_ALREADY_EXISTS` | Registration with an address already in use |
| 409 | `INVALID_STATUS_TRANSITION` | The workflow forbids the move |
| 409 | `PROJECT_NOT_EMPTY` | Deleting a project that has tasks |
| 409 | `PROJECT_CLOSED` | Adding a task to a completed project |
| 409 | `USER_OWNS_PROJECTS` | Deleting a user who owns projects |
| 409 | `LAST_LEAD` | Deleting or demoting the last lead |
| 413 | `PAYLOAD_TOO_LARGE` | Body over 1 MB |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Body is not `application/json` |
| 422 | `VALIDATION_ERROR` | Bad fields, unknown fields, bad query, unknown referenced id |
| 429 | `RATE_LIMITED` | Too many login or registration attempts; see `Retry-After` |
| 500 | `INTERNAL_ERROR` | Unexpected; generic message, details are in the server log |
| 503 | `SERVICE_UNAVAILABLE` | `/readyz` when a dependency is down |

## Database

Four tables (`users`, `projects`, `tasks`, `activity`) hold all data. The database enforces what it
can: lengths, enums, a unique lower-case email, an `https` avatar, `completed_at` set exactly when a
task is `done`, and six foreign keys with deliberate delete rules. Diagram and column-by-column
reference: [database/docs/erd.mmd](database/docs/erd.mmd) and
[database/docs/data-dictionary.md](database/docs/data-dictionary.md), both generated from the live
schema and checked for drift.

### Local setup in three commands

```bash
make env          # writes .env with freshly generated passwords (git-ignored); or copy .env.example and set them
make db-up        # starts PostgreSQL 16 in Docker and creates the three roles
make db-migrate   # applies the migrations; then: make run
```

Load demo data with `python -m app.seed --profile default --reset --yes` (profiles `default`,
`empty`, `large` and `xl`; `--reset` clears every table first and both flags are refused in
production).

### Roles

| Role | May do | Used by |
| --- | --- | --- |
| `ih_admin` | Everything; provisioning only | The operator |
| `ih_migrator` | Owns the schema; creates and alters objects | `make db-migrate` in CI and deploy |
| `ih_app` | Select, insert, update, delete rows. No DDL | The running API (`DATABASE_URL`) |
| `ih_readonly` | Select on every table except `users.password_hash` | Reporting |

Secrets come only from the environment. Compose stops if a password is unset, the port is bound to
`127.0.0.1`, settings and logs never print a connection string, and production refuses the memory
backend and a connection string without `?ssl=require`. `MIGRATION_DATABASE_URL` belongs to the
deploy step, not to the running API.

### Migrations

Alembic, written by hand from the models and reviewed (BR-310). Every revision has a downgrade and
the gate runs up, down and up again on an empty and on a seeded database, then `alembic check`.
The API never migrates itself in production.

```bash
make db-migrate   # alembic upgrade head, as the migration role
make db-check     # alembic check, naming rules and column types
make db-docs      # regenerate the ERD and the data dictionary after a schema change
```

### Backup and restore

`make db-backup` writes a compressed dump outside the repository (it holds password hashes, so keep
it private and encrypted). `make db-restore-test` dumps the database, restores it into a scratch
database, and compares row counts and primary-key checksums with the source. Documented objectives:
recovery point 24 hours, recovery time 1 hour, using daily dumps.

### Tests against PostgreSQL

The tests start a disposable PostgreSQL container, build its schema by running the real migrations,
and clone it once per worker. Run the whole Task 2 suite on it with `pytest --backend sql`; the
default `--backend memory` is for quick loops. Concurrency, outage and restart tests are included.

## Architecture

```
app/api        routers: parse, call a service, shape the response. No business rules.
app/services   business rules and authorization. Raise AppError subclasses; never import FastAPI.
app/repositories  async Protocols, a unit of work, an in-memory implementation (tests only)
                  and the PostgreSQL one in repositories/sql (the only place SQLAlchemy is imported).
app/domain     entities, enums, pure rules, query objects.
app/core       settings, errors, logging, middleware, security, clock, rate limiter.
```

The layer rules are enforced by `import-linter` (`make layers`), not by convention. The clock and
id factory are injected, so tests control time. Swapping the in-memory store for a database means
writing a new set of repositories; a contract test suite runs against every implementation.

## The quality gate

```bash
make gate        # everything below, stops at the first failure
```

| Target | What it checks |
| --- | --- |
| `make lint` | `ruff check` and `ruff format --check` (complexity at most 10) |
| `make typecheck` | `mypy --strict` on `app`, `scripts` and `tests` |
| `make layers` | import-linter contracts |
| `make test` | pytest with coverage (threshold 90%) and the endpoint-coverage gate |
| `make spec-check` | `docs/openapi.json` equals what the app generates |
| `make spec-diff` | no breaking change against `origin/main` |
| `make contract` | Schemathesis over every operation |
| `make security` | bandit and pip-audit |
| `make postman` | the Postman collection under Newman |
| `make load` | Locust on 500 tasks, p95 thresholds |
| `make docker` | the image builds |
| `make db-gate` | the data-layer gate: migrations, integrity, concurrency, security, performance, docs, restore |

After changing an endpoint, run `make export-spec` and commit `docs/openapi.json`; CI fails if it is
stale. `make secrets` runs gitleaks if it is installed (CI always runs it).

## Deploying

`render.yaml` builds the Dockerfile as one worker with a `/healthz` check. In the Render dashboard
set `DATABASE_URL` (the application role, ending `?ssl=require`), `SEED_PASSWORD` and
`CORS_ORIGINS`; `SECRET_KEY` is generated. Apply the schema once from your machine, as the migration
role, before the first deploy:

```bash
MIGRATION_DATABASE_URL='postgresql+asyncpg://ih_migrator:<set-me>@<host>:5432/<db>?ssl=require' alembic upgrade head
```

The demo deployment is seeded on an empty database and is not `APP_ENV=production`; see
[ADR-221](docs/adr/ADR-221-render-demo-seeding.md). Data now persists across restarts and deploys.

## Known limitations

- **The rate limiter is per process** ([ADR-216](docs/adr/ADR-216-in-process-rate-limiter.md)), so
  the service runs one worker. A shared store and more workers are on the roadmap.
- **Deletes are hard.** There is no soft delete and `activity` is a feed, not an audit log.
- **Roles limit what the API can do, not what a compromised API may read.** Row-level security is a
  roadmap item.
- **Tokens cannot be revoked** before they expire (15 minutes). There is no refresh token.
- **Task 1 features with no endpoint:** password reset, password and email change, avatar upload
  ([compatibility notes](docs/compatibility-task1.md)).
- **Registration always creates a developer.** The first lead has to be seeded.
