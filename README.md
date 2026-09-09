# AI-Powered Project & Task Management Platform

**Task 4 (capstone)** of the Innovation Hacks Full Stack Development
Internship — a full-stack project and task manager with real
authentication, a Postgres-backed API, and one working AI feature. It
integrates the frontend built in Task 1, the REST API built in Task 2,
and the database layer built in Task 3, then adds everything Task 4
requires on top: auth, full CRUD, and AI-assisted task generation.

## Demo

- **Demo video**: _add link here after recording_ — see
  [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md) for the timestamped shot list
  (2–5 min, per the internship's Demo Video Requirements).
- **Live deployment**: _pending — add the link here once deployed._
  Deployment is optional per the submission requirements; this repo is
  ready to deploy (see [Deployment](#deployment) below).

## Screenshots

| Login | Register |
| --- | --- |
| ![Login](frontend/docs/screenshots/01-login-desktop.png) | ![Register](frontend/docs/screenshots/02-register-desktop.png) |

| Login (mobile, 375px) |
| --- |
| ![Login mobile](frontend/docs/screenshots/03-login-mobile.png) |

Screenshots of the authenticated app (dashboard, project detail, task
management, the AI panel) aren't captured yet — they need a live
database session, which this development environment couldn't reach
locally (Docker access blocked; see
[docs/handoffs/04-backend-database-engineer.md](docs/handoffs/04-backend-database-engineer.md)).
Add them here once the app is running against a real database — the
UI/UX handoff (`docs/handoffs/02-ui-ux-specialist.md`) describes every
screen in detail in the meantime.

## Feature List

**Authentication**
- Register, log in, log out
- Passwords hashed with Argon2id — never stored, logged, or returned in
  plaintext
- Session via an httpOnly JWT cookie (with a Bearer-header fallback for
  API clients); every protected page and endpoint rejects an
  unauthenticated request
- CSRF-hardened: every mutating request requires a header a plain
  cross-site form can never send

**Dashboard**
- Real-time stats: active projects, open/in-progress/blocked task counts
- Project grid with per-project progress (computed live from that
  project's tasks, not a stored field)
- Cross-project "My tasks" list with search and status filter
- Loading / empty / error states on every data-bound view

**Project Management**
- Create, edit, delete, and view project details
- Every project is scoped to its owner — another user gets a 404, not a
  403, so resource existence is never leaked

**Task Management**
- Create, edit, delete tasks
- Assign to any user, set priority (low/medium/high) and due date
- Quick status change (todo / in-progress / done / blocked) inline
- Search by title, filter by status and priority, combinable

**AI-Assisted Task Generation**
- One click on a project's page generates a set of candidate tasks from
  its name/description (+ optional instructions), which you review, edit,
  and selectively add
- Backed by the real Gemini API (`GEMINI_API_KEY`) — chosen because
  Gemini has a genuine free tier, no billing setup required — with a
  deterministic, honestly-labeled fallback checklist when no key is set
  or the call fails for any reason — the feature never breaks, and never
  claims fallback output is AI-generated

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4 |
| Backend | Python 3.14, FastAPI, Pydantic v2 |
| Database | PostgreSQL 16, SQLAlchemy 2.0, Alembic migrations |
| Auth | PyJWT (HS256), Argon2id (`argon2-cffi`) |
| AI | Gemini API (`gemini-3.6-flash` by default), JSON-schema structured output |
| Testing | pytest (backend, 90 tests), Vitest + Testing Library (frontend, 15 tests), Playwright + axe-core (browser/a11y QA) |
| Deployment target | Render (API + managed Postgres) + Vercel (frontend) |

## Architecture

```mermaid
flowchart LR
    Browser -->|HTTPS, httpOnly cookie| Frontend[Next.js frontend<br/>Vercel]
    Frontend -->|fetch, credentials: include| API[FastAPI backend<br/>Render]
    API --> DB[(PostgreSQL<br/>Render)]
    API -->|structured-output call| AI[Gemini API]
    AI -.fallback on failure.-> API
```

## Getting Started

Four layers to bring up: database → backend → frontend, with every
environment variable set first.

### 1. Clone

```bash
git clone https://github.com/Aime-Serge/innovation-hacks-task4-platform.git
cd innovation-hacks-task4-platform
```

### 2. Start the database (Docker)

```bash
cd backend
docker compose up -d
```

This starts a local Postgres 16 container (`ih-task4-db`), loopback-only,
with a throwaway dev password — never a shared or production database.

### 3. Backend: install, configure, migrate, run

```bash
# still inside backend/
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# then edit .env — see Environment Variables below
alembic upgrade head

uvicorn app.main:app --reload --port 8000
```

API docs are then live at `http://localhost:8000/docs`.

### 4. Frontend: install, configure, run

```bash
cd ../frontend
npm install

cp .env.example .env.local
# NEXT_PUBLIC_API_URL should point at the backend above

npm run dev
```

App is then live at `http://localhost:3000`.

## Environment Variables

Every variable the app reads, across both layers. Real values only ever
go in `.env`/`.env.local` (gitignored) — `.env.example` in each package
documents the keys with placeholders, never real values.

### `backend/.env`

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | SQLAlchemy connection string, e.g. `postgresql+psycopg2://postgres:devpassword@localhost:5432/ih_task4` |
| `SECRET_KEY` | Yes | Signs auth JWTs — no insecure default. Generate with `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `CORS_ORIGINS` | Yes | Comma-separated allowed frontend origins, e.g. `http://localhost:3000` |
| `GEMINI_API_KEY` | No | Powers real AI task generation; omitted → deterministic fallback, feature still works. Free tier available at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `GEMINI_MODEL` | No | Default `gemini-3.6-flash` |
| `APP_ENV` | No | `development` (default) or `production` — controls cookie `Secure`/`SameSite` flags |
| `HOST` / `PORT` / `LOG_LEVEL` | No | Server bind config |

### `frontend/.env.local`

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Yes | Base URL of the backend, no trailing slash |

## Testing

```bash
# Backend (needs the database running and migrated)
cd backend && source .venv/bin/activate
pytest                    # 90 tests: unit + integration + end-to-end journey

# Frontend
cd frontend
npm test                  # Vitest, 15 tests
npx tsc --noEmit           # type-check

# Frontend browser/accessibility QA (needs `npm run dev` running)
BASE_URL=http://localhost:3000 node scripts/qa-checks.mjs
```

## Deployment

Target: **Render** for the API + a managed Postgres instance, **Vercel**
for the frontend — chosen for zero-config fit with FastAPI/Uvicorn and
Next.js respectively, and both have workable free tiers for a project
this size. See [`docs/handoffs/`](docs/handoffs/) for the full role-by-
role build record, including the security review that gated deployment.

## Project Structure

```
backend/
  app/
    routers/       auth, users, projects, tasks, ai
    repositories/  Postgres-backed data access
    models/        Pydantic request/response schemas
    db/            SQLAlchemy models, session, migrations base
    security.py    Argon2id hashing, JWT issue/verify
    csrf.py         mutation CSRF guard
  migrations/       Alembic, versioned
  tests/            90 tests: unit, integration, end-to-end

frontend/
  app/              Next.js App Router pages (/, /login, /register, /projects/[id])
  components/       auth, projects, tasks, ai, shared UI primitives
  lib/              api client, data layer, auth context
  proxy.ts          route-protection gate (Next 16's renamed middleware.ts)
  scripts/          Playwright + axe browser QA

docs/handoffs/       one artifact per development role, in build order —
                      Product Manager through QA Engineer
```

## Security

Full security review completed and signed off Clear — see
[`docs/handoffs/07-security-reviewer.md`](docs/handoffs/07-security-reviewer.md)
for the complete pass/fail breakdown (password handling, session/CSRF,
authorization, secrets management, unauthenticated-surface exposure) and
the one real finding (a CSRF gap) that was found, fixed, and verified
before this sign-off.

**Never commit real values** for `SECRET_KEY`, `DATABASE_URL`, or
`GEMINI_API_KEY` — both `.env.example` files list every key with
placeholders only.
