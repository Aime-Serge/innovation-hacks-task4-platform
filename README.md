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
- **Live deployment**: https://task-management-ai-blush.vercel.app
  — frontend on Vercel, API on Render
  ([Swagger docs](https://ih-task4-api-h4jr.onrender.com/docs),
  [health](https://ih-task4-api-h4jr.onrender.com/health)), PostgreSQL on
  Render. Register a new account, then log in, to try it. The free tier sleeps when idle,
  so the first request after a quiet period can take up to a minute.
  Verified end to end against this deployment: register, project and task
  creation, a real Gemini call, logout, password reset, settings and avatar
  upload (15 of 15 browser checks passing).

## Screenshots

All captured against the actual running app — real Postgres, real
session, and (for the AI panel) a real Gemini response.

| Login | Register |
| --- | --- |
| ![Login](frontend/docs/screenshots/01-login-desktop.png) | ![Register](frontend/docs/screenshots/02-register-desktop.png) |

| Login (mobile, 375px) |
| --- |
| ![Login mobile](frontend/docs/screenshots/03-login-mobile.png) |

| Dashboard (desktop) | Dashboard (mobile) |
| --- | --- |
| ![Dashboard](frontend/docs/screenshots/04-dashboard-desktop.png) | ![Dashboard mobile](frontend/docs/screenshots/05-dashboard-mobile.png) |

| Project detail | AI-generated tasks |
| --- | --- |
| ![Project detail](frontend/docs/screenshots/06-project-detail.png) | ![AI generate tasks](frontend/docs/screenshots/07-ai-generate-tasks.png) |

| New task modal | Settings |
| --- | --- |
| ![New task modal](frontend/docs/screenshots/08-new-task-modal.png) | ![Settings](frontend/docs/screenshots/09-settings.png) |

## Feature List

**Authentication & Profile**
- Register, then log in (registering creates the account but does not
  sign you in), log out
- Passwords hashed with Argon2id — never stored, logged, or returned in
  plaintext
- Session via an httpOnly JWT cookie (with a Bearer-header fallback for
  API clients); every protected page and endpoint rejects an
  unauthenticated request
- CSRF-hardened: every mutating request requires a header a plain
  cross-site form can never send
- Forgot/reset password — single-use, 30-minute-expiring, hashed
  reset token (dev mode: the reset link is returned directly rather
  than emailed, since this build has no email provider wired up; see
  [Security](#security) for what that means and what a real deployment
  needs to change)
- Change password (while logged in — requires the current password,
  distinct from the reset flow above)
- Edit profile (name, email)
- Avatar upload/remove (PNG/JPEG/WebP, capped at 500 KB, stored directly
  in Postgres — no external object-storage dependency)
- Delete account (self-service, with a confirmation step)

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
| Testing | pytest (backend, 108 tests), Vitest + Testing Library (frontend, 18 tests), Playwright + axe-core (browser/a11y QA) |
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
| `FRONTEND_URL` | No | Used to build the password-reset link. **Set this to the real frontend URL in production** — left at the `http://localhost:3000` default, reset links would point at a dev server no one can reach. |
| `AVATAR_MAX_BYTES` | No | Default 500 KB |
| `AVATAR_ALLOWED_MIME_TYPES` | No | Default `image/png,image/jpeg,image/webp` |
| `APP_ENV` | No | `development` (default) or `production` — controls cookie `Secure`/`SameSite` flags |
| `HOST` / `PORT` / `LOG_LEVEL` | No | Server bind config |

### `frontend/.env.local`

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Yes | Local dev: the backend's URL, no trailing slash. Production: `/api` (calls are proxied same-origin — see [Deployment](#deployment)) |
| `API_PROXY_TARGET` | Production only | Server-side. The API's real base URL that `/api/*` is proxied to, e.g. `https://ih-task4-api.onrender.com` |
| `NEXT_PUBLIC_API_DOCS_URL` | No | Public URL of the API's Swagger docs, used by the footer link when `NEXT_PUBLIC_API_URL` is `/api` |

## Testing

```bash
# Backend (needs the database running and migrated)
cd backend && source .venv/bin/activate
pytest                    # 108 tests: unit + integration + end-to-end journey

# Frontend
cd frontend
npm test                  # Vitest, 18 tests
npx tsc --noEmit           # type-check

# Frontend browser/accessibility QA (needs `npm run dev` running)
BASE_URL=http://localhost:3000 node scripts/qa-checks.mjs

# Full live end-to-end check — real browser, real backend, real DB, and
# (if GEMINI_API_KEY is set) a real Gemini call. Needs the database,
# backend, and frontend all actually running (see Getting Started above).
BASE_URL=http://localhost:3000 node scripts/live-e2e-check.mjs
```

## Deployment

Target: **Render** (API + managed Postgres) and **Vercel** (frontend),
both on free tiers. Config is already in the repo: [`render.yaml`](render.yaml)
is a Render Blueprint for the API and database; Vercel needs only a root
directory and three variables.

### 1. Render (API + database)

1. render.com → **New → Blueprint** → select this repo. It reads
   `render.yaml` and creates `ih-task4-db` and `ih-task4-api`.
2. Fill in the prompted values: `SECRET_KEY` (generate with
   `python3 -c "import secrets; print(secrets.token_urlsafe(48))"`),
   `GEMINI_API_KEY` (optional — without it the AI feature uses its
   labeled fallback), `GEMINI_MODEL` (`gemini-3.6-flash`), and
   placeholder values for `CORS_ORIGINS` / `FRONTEND_URL` for now.
   `DATABASE_URL` is wired in automatically.
3. Wait for the build (`pip install` + `alembic upgrade head`), then check
   `https://<your-api>.onrender.com/health`.

### 2. Vercel (frontend)

1. vercel.com → **Add New → Project** → import this repo, set **Root
   Directory** to `frontend`.
2. Add three environment variables:
   - `NEXT_PUBLIC_API_URL` = `/api`
   - `API_PROXY_TARGET` = your Render API URL (no trailing slash)
   - `NEXT_PUBLIC_API_DOCS_URL` = `<your Render API URL>/docs` (optional)
3. Deploy.

### 3. Connect them

Back on Render, set `CORS_ORIGINS` and `FRONTEND_URL` to the Vercel URL
and let the service redeploy.

### Why the frontend proxies `/api` instead of calling Render directly

The API sets the session cookie on its own domain (`*.onrender.com`).
The frontend runs on a different one (`*.vercel.app`), so that cookie is
never sent to the frontend's route guard (`proxy.ts`) — a logged-in user
would be bounced back to `/login` forever — and Safari and Firefox block
such cross-site cookies outright. Routing API calls through
`/api/*` (a Next.js rewrite, `next.config.ts`) makes them same-origin, so
the cookie is first-party. Related: after login, register (which redirects to the login page), and logout the
app does a full page load rather than a client-side navigation, because
production builds prefetch links and cache the guard's logged-out
redirect, which would otherwise be replayed right after login.

Both behaviours were verified with the full browser journey
(`frontend/scripts/live-e2e-check.mjs`) against a production build,
with the API in `APP_ENV=production` so cookies carry the real
`SameSite=None; Secure` flags.

### Notes

- Render's free tier sleeps after inactivity; the first request after a
  while takes ~30s to wake it.
- Pushes to `main` redeploy both platforms automatically.
- See [`docs/handoffs/`](docs/handoffs/) for the full role-by-role build
  record, including the security review that gated deployment.

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
  tests/            108 tests: unit, integration, end-to-end

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

**Known, deliberate tradeoff — forgot-password in dev mode**: this build
has no email provider wired up, so `POST /auth/forgot-password` returns
the reset link directly in its response instead of emailing it (see the
loud comment on `ForgotPasswordResponse` in
`backend/app/models/auth.py`). That means anyone who can call that
endpoint with a known email gets that account's reset link — a real
account-takeover vector if this were ever pointed at genuine user data.
It's acceptable here only because this is a demo/internship build with
no real users; a real deployment must swap this for actually emailing
the link (e.g. Resend, which also has a free tier) and drop
`dev_reset_url` from the response entirely.
