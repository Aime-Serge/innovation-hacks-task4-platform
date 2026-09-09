# Users, Projects & Tasks API

Task 3 of the Innovation Hacks Full Stack Development Internship — a REST API for managing users, projects, and tasks, built with **Python + FastAPI** and backed by **PostgreSQL**. This is the backend that Task 1's dashboard and Task 4's platform will consume.

## Technology Stack

- **Python 3.14**
- **FastAPI** — routing, request/response validation, OpenAPI generation
- **Pydantic v2** / **pydantic-settings** — data validation and environment-based configuration
- **PostgreSQL 16** — persistent data store (Docker for local dev)
- **SQLAlchemy 2.0** — ORM / data access layer
- **Alembic** — versioned, hand-written schema migrations
- **Uvicorn** — ASGI server
- **pytest** + **httpx** (via FastAPI's `TestClient`) — test suite, run against a real Postgres instance

## Features

- User management: create, list, get, update, delete
- Project management: create, list (with optional `owner_id` filter), get by id
- Task management: create, list (with optional `project_id`/`status` filters), get by id, update, delete
- Dedicated task status-transition endpoint (`todo` / `in-progress` / `done`)
- Centralized error handling — every error response shares one JSON shape
- Input validation on every write operation via Pydantic models
- Environment-variable-driven configuration, no hardcoded secrets
- Auto-generated interactive API docs at `/docs` and `/redoc`

## Architecture Notes

- **Storage**: PostgreSQL via SQLAlchemy (`app/db/`), behind repositories (`app/repositories/`) that expose the exact same method signatures Task 2's in-memory store used. `app/routers/` has a **zero-line diff** from Task 2 — the interface abstraction meant the persistence swap required no route changes at all.
- **Relationships**: `Project.owner_id` references a `User`; `Task.project_id` references a `Project`. Creating a project/task with a non-existent owner/project returns `404` (API-layer check, unchanged from Task 2) — and the foreign keys enforce it at the schema level too.
- **Cascade rule**: both foreign keys are `ON DELETE CASCADE` — deleting a user deletes their projects (and those projects' tasks); deleting a project deletes its tasks. This preserves Task 2's existing `DELETE /users/{id}` behavior (which already deletes unconditionally, with no ownership check) instead of introducing a new FK-violation error path.
- **Auth-readiness**: each router is registered with `dependencies=[]`. Task 4 adds the auth dependency at the router level, with no changes to individual handlers.
- **No authentication yet**: user passwords are stored hashed (PBKDF2-HMAC-SHA256, salted) for forward compatibility, but there is no login/token endpoint — that's Task 4's explicit "Authentication" requirement.

## Schema / ER Diagram

```mermaid
erDiagram
    USERS ||--o{ PROJECTS : owns
    PROJECTS ||--o{ TASKS : contains

    USERS {
        uuid id PK
        varchar_100 name
        varchar_320 email UK
        varchar_255 password_hash
        timestamptz created_at
    }
    PROJECTS {
        uuid id PK
        varchar_150 name
        text description
        uuid owner_id FK
        timestamptz created_at
    }
    TASKS {
        uuid id PK
        varchar_200 title
        text description
        uuid project_id FK
        enum status
        timestamptz created_at
        timestamptz updated_at
    }
```

- `projects.owner_id -> users.id`, `ON DELETE CASCADE`
- `tasks.project_id -> projects.id`, `ON DELETE CASCADE`
- `tasks.status` is a native Postgres enum (`todo` / `in-progress` / `done`), independent of the Pydantic-level check
- Indexes: `users.email` (unique), `projects.owner_id`, `tasks.project_id`, `tasks.status`, composite `(project_id, status)` for the combined filter used by Task 1's search/filter feature

## Getting Started

### 1. Create an isolated virtual environment

```bash
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Start Postgres (Docker — never a shared/production database)

```bash
docker compose up -d
# or: docker run --name ih-task3-db -e POSTGRES_PASSWORD=devpassword \
#       -e POSTGRES_DB=ih_task3 -p 127.0.0.1:5432:5432 -d postgres:16
```

A free-tier managed host (Supabase / Neon / Railway) works too — just put its connection string in `DATABASE_URL` in the next step.

### 4. Configure environment variables

```bash
cp .env.example .env
# then set DATABASE_URL, e.g.:
# DATABASE_URL=postgresql+psycopg2://postgres:devpassword@localhost:5432/ih_task3
```

`.env` is gitignored — never commit real secrets. See [Environment Variables](#environment-variables) below for what each key means.

### 5. Run migrations

```bash
alembic upgrade head
```

### 6. Seed sample data (optional)

```bash
python -m app.seed
```

Inserts 3 users, 4 projects, and 10 tasks across all three statuses. Safe to re-run — it's a no-op if the `users` table already has rows.

### 7. Run the server

```bash
uvicorn app.main:app --reload
```

The API is now available at `http://localhost:8000`. Interactive docs:

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### 8. Run the tests

```bash
pytest -v
```

`pytest` applies migrations and truncates all tables before every test (see `tests/conftest.py`), so it needs `DATABASE_URL` pointed at a real, reachable Postgres — point it at a database you don't mind being wiped, or use a separate one (e.g. `ih_task3_test`) if you want seeded data to survive alongside test runs.

## Environment Variables

| Variable | Purpose | Status |
|---|---|---|
| `APP_ENV` | `development` / `production` flag | active |
| `HOST` | Bind address | active |
| `PORT` | Bind port | active |
| `LOG_LEVEL` | Logging verbosity | active |
| `DATABASE_URL` | SQLAlchemy Postgres connection string | **active** — required, no hardcoded fallback |
| `SECRET_KEY` | Auth signing key | placeholder — unused until Task 4 |

See `.env.example` for the full template (keys only, no real values).

## Route Table

All error responses share this shape:

```json
{"error": {"code": "not_found", "message": "...", "details": null}}
```

### Users

| Method | Path | Purpose | Success | Failure |
|---|---|---|---|---|
| POST | `/users` | Create a user | 201 | 422, 409 |
| GET | `/users` | List users | 200 | — |
| GET | `/users/{user_id}` | Get user by id | 200 | 404 |
| PATCH | `/users/{user_id}` | Partially update a user | 200 | 404, 422, 409 |
| DELETE | `/users/{user_id}` | Delete a user | 204 | 404 |

### Projects

| Method | Path | Purpose | Success | Failure |
|---|---|---|---|---|
| POST | `/projects` | Create a project | 201 | 422, 404 (owner not found) |
| GET | `/projects` | List projects (optional `?owner_id=`) | 200 | — |
| GET | `/projects/{project_id}` | Get project by id | 200 | 404 |

### Tasks

| Method | Path | Purpose | Success | Failure |
|---|---|---|---|---|
| POST | `/tasks` | Create a task | 201 | 422, 404 (project not found) |
| GET | `/tasks` | List tasks (optional `?project_id=`, `?status=`) | 200 | — |
| GET | `/tasks/{task_id}` | Get task by id | 200 | 404 |
| PATCH | `/tasks/{task_id}` | Update task title/description | 200 | 404, 422 |
| PATCH | `/tasks/{task_id}/status` | Transition task status (`todo`/`in-progress`/`done`) | 200 | 404, 422 |
| DELETE | `/tasks/{task_id}` | Delete a task | 204 | 404 |

### Health

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Service health check |

## Status Code Policy

- **200** — successful GET/PATCH
- **201** — successful POST (resource created)
- **204** — successful DELETE (no body)
- **404** — path id not found, or a body field referencing another resource (`owner_id`, `project_id`) doesn't exist
- **409** — conflict (duplicate user email)
- **422** — Pydantic validation failure (missing/invalid field, bad enum value) — FastAPI's native behavior, kept as-is rather than remapped to 400
- **500** — unhandled server error, generic message only; full traceback logged server-side

## Screenshots

_Add screenshots of `/docs` (Swagger UI) and a few example requests/responses here before submitting._

## Demo

_Add the demo video link here before submitting._
