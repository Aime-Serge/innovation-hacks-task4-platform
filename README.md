# AI-Powered Project & Task Management Platform

Task 4 (capstone) of the Innovation Hacks Full Stack Development Internship: the Task 1 frontend, the Task 2 API and the Task 3 PostgreSQL layer in one application, with three AI features that only ever suggest. It is built to the Task 4 Engineering Standards Pack in [`docs/standards/`](docs/standards/).

A person registers, signs in, manages projects and tasks, and can ask an AI provider to generate tasks, rank priorities or summarise a project. The AI never changes anything by itself: the person reviews, edits and confirms, and confirmed changes go through the same endpoints as manual ones.

## Features

Each feature is tied to the requirement of the [Innovation Hacks guide](docs/standards/innovation-hacks-guide.pdf) it serves; the row-by-row check is in [`docs/guide-compliance.md`](docs/guide-compliance.md).

| Guide requirement | Feature | State |
|---|---|---|
| Task 1: dashboard, navigation, project and task cards, progress, search and filter, responsive, loading and empty states | Next.js dashboard, sidebar and drawer navigation, cards, progress bars, filters kept in the URL, skeleton, empty and error states | Built (Tasks 1 and 4) |
| Task 2: users, projects, tasks, status workflow, one error envelope, validation, status codes | FastAPI REST API with an enforced status workflow, validated writes and documented OpenAPI | Built |
| Task 3: persistent users, projects and tasks, database-level validation, relationships, secure configuration | PostgreSQL 16, named constraints, foreign keys, three database roles, environment-only credentials | Built |
| Task 4: registration, login, logout, protected routes | Sign-in with rotating refresh tokens in `HttpOnly` cookies, route guard, logout | Built |
| Task 4: dashboard statistics and recent activity | Dashboard summary and activity feed | Built |
| Task 4: project management, task management, assign, priority, due dates | Project and task CRUD, assignment, priority, due dates, search and filter | Built |
| Task 4: at least one AI feature | AI task generation, prioritisation and project summary; the AI only suggests | Built; live evaluation not yet run ([`docs/ai-evaluation.md`](docs/ai-evaluation.md)) |
| Task 1: user and profile section; Task 4: registration | Two-step registration that captures professional information, own profile page and editor, member profile page | Built and covered by live profile tests |
| Task 4: assign tasks | People picker showing each member's discipline and company | Built and covered by live profile tests |
| Task 4: logout; security | Settings (profile, preferences, privacy, account), change password, sign out of all devices | Built; account deletion remains subject to the documented ownership conflict |

## Technology stack

Next.js and TypeScript (frontend, on Vercel); FastAPI, SQLAlchemy 2 async and Alembic on Python 3.12 (API, on Render); PostgreSQL 16; Gemini as the live AI provider with a deterministic fake for tests; Playwright, Vitest, pytest and schemathesis for tests; gitleaks, `npm audit` and `pip-audit` for security checks; Docker Compose for the local stack. Exact versions are in `frontend/package.json` and `backend/pyproject.toml`.

## Architecture

```mermaid
flowchart LR
  B["Browser"] --> V["Vercel<br/>Next.js pages +<br/>server layer /api/bff"]
  V --> A["Render web service<br/>FastAPI"]
  A --> D[("Render PostgreSQL 16")]
  A --> L["AI provider (Gemini)<br/>external"]
  M["Migration step<br/>ih_migrator, from your machine"] --> D
```

- The browser talks **only** to the site. The server layer (`frontend/src/lib/session`, route `/api/bff`) keeps the session in `HttpOnly` cookies, forwards calls to the API with the Bearer token, checks the `Origin` of every write, allows JSON bodies only and a fixed list of API areas, applies a timeout and passes `X-Request-ID`. No token is ever readable by page scripts.
- The API (`backend/`) is Bearer-only. It holds the business rules, authentication, visibility scoping and the AI pipeline; only it talks to the database and the AI provider.
- Three database roles: `ih_migrator` (owns the schema, used only for migrations), `ih_app` (rows only, used by the API) and `ih_readonly` (no access to password hashes or tokens).
- Decisions are in [`docs/adr/`](docs/adr/README.md); where the pack and the code disagreed, the readbacks are in [`docs/pack-readback-task4.md`](docs/pack-readback-task4.md) and [`docs/pack-readback-final.md`](docs/pack-readback-final.md) (minimal profile).

```text
frontend/   Next.js, TypeScript only: pages, HTTP adapter, AI screens, server layer
backend/    FastAPI, SQLAlchemy 2 async, Alembic: API, migrations, AI pipeline (its own README)
docs/       standards packs, ADRs, runbook, AI evaluation, supersession log, blockers
scripts/    deploy check, smoke test, provisioning, migration, demo data, fault injection
render.yaml docker-compose.yml Makefile
```

## Run it locally

Needs Docker, Node 22, Python 3.12 with `uv`, and `make`.

```bash
make env          # writes .env with random local secrets (git-ignored)
make up           # database, migrations, API on :8000, site on :3000
open http://localhost:3000/register
```

Three commands install and start everything: `make env`, `make up`, then open the address. The local stack uses the **fake** AI provider, so it needs no key and costs nothing. To try failures, restart the API with `FAKE_LLM_SCENARIO=timeout`, `bad_json`, `too_long`, `injection_echo`, `rate_limited` or `invalid_then_ok`, with `AI_ENABLED=false`, or with `AI_DAILY_LIMIT_PER_USER=1`. Realistic sample data for an account: `SITE_URL=http://localhost:3000 DEMO_EMAIL=you@example.com DEMO_PASSWORD=... make demo-data`.

## Screenshots

Task 1 screenshots are in [`frontend/docs/screenshots/`](frontend/docs/screenshots/) and Task 3 screenshots in [`backend/docs/screenshots/`](backend/docs/screenshots/). The Task 4 set is captured by `make screenshots` (script: [`scripts/screenshots.ts`](scripts/screenshots.ts)) into [`docs/screenshots/task-4/`](docs/screenshots/task-4/) at 1440x900 and 390x844, using synthetic data only. The current set contains 18 screens covering login, registration, dashboard, projects, tasks, profile, settings, member profile and task assignment.

## Demo

| Item | Link |
|---|---|
| Demo video (2 to 5 minutes) | `<pending>` |
| Live site (optional) | `<pending>` |
| Demo script | [`docs/submission/demo-script.md`](docs/submission/demo-script.md) |

## Task submissions

The four items the guide asks for on each task. Links are filled in by the author after publishing.

| Task | GitHub repository | Demo video | Live deployment (optional) | LinkedIn post (Innovation Hacks tagged) |
|---|---|---|---|---|
| Task 1 | `<pending>` | `<pending>` | `<pending>` | `<pending>` |
| Task 2 | `<pending>` | `<pending>` | `<pending>` | `<pending>` |
| Task 3 | `<pending>` | `<pending>` | `<pending>` | `<pending>` |
| Task 4 | `<pending>` | `<pending>` | `<pending>` | `<pending>` |

## Environment variables

**API on Render** (the full list with defaults is in [`backend/README.md`](backend/README.md#configuration)). Secrets are set only in the dashboard.

| Variable | Purpose | Required | Notes |
|---|---|---|---|
| `APP_ENV` | Environment name | Yes | `production` |
| `STORAGE_BACKEND` | Storage | Yes | `sql` |
| `DATABASE_URL` | Application role connection | Yes | Secret; async driver scheme; TLS required |
| `JWT_SECRET` | Token signing key | Yes | Secret; 32 bytes or more; different in every environment |
| `ACCESS_TOKEN_TTL_S`, `REFRESH_TOKEN_TTL_S` | Session lifetimes | No | 900 and 604800 |
| `CORS_ALLOWED_ORIGINS` | Allowed browser origins | Yes | The Vercel site; no wildcard |
| `REGISTRATION_ENABLED` | Open registration | No | `true` |
| `DOCS_ENABLED` | Swagger UI and ReDoc | No | `false` in production |
| `AI_ENABLED` | AI kill switch | No | `true` |
| `LLM_PROVIDER` | `gemini` or `fake` | Yes | `fake` is refused in production |
| `LLM_API_KEY` | Provider key | With a live provider | Secret; a separate key per environment |
| `LLM_MODEL` | Model name | With a live provider | Never hard-coded |
| `LLM_TIMEOUT_S`, `LLM_MAX_OUTPUT_TOKENS` | Call limits | No | 20 and 1024 |
| `AI_DAILY_LIMIT_PER_USER`, `AI_PER_MINUTE_LIMIT`, `AI_GLOBAL_DAILY_LIMIT` | Quotas | No | 20, 5, 500 |
| `MIN_AGE` | Minimum age the registration checkbox confirms (added on feat/minimal-profile) | No | 16; no birth date is stored |
| `TERMS_VERSION` | Terms version stored at registration (added on feat/minimal-profile) | No | `2026-09` in `.env.example`; existing users are `legacy` |
| `MIGRATION_DATABASE_URL` | Migration role | **Never set on the service** | Only in your shell for `make db-migrate-prod` |

**Frontend on Vercel** (server-only; none starts with `NEXT_PUBLIC_`).

| Variable | Purpose | Notes |
|---|---|---|
| `API_BASE_URL` | The Render API, used only by the server layer | https in production |
| `SITE_URL` | The site's own origin, for the `Origin` check | https in production |
| `BFF_TIMEOUT_MS` | Upstream timeout of the server layer | 28000 |
| (none added) | The minimal profile adds no frontend variable, so `MIN_AGE` and `TERMS_VERSION` are API-only | |
| `APP_ENV`, `ALLOW_INSECURE_COOKIES` | Local plain-HTTP development only | Production refuses `ALLOW_INSECURE_COOKIES`; leave both unset there |

## Deploying

The step-by-step is in [`docs/deploy-runbook.md`](docs/deploy-runbook.md): Render blueprint, `make db-provision`, `make db-migrate-prod`, `DATABASE_URL` composed by hand, Vercel with root `frontend/`, then `make smoke` and `make e2e-live`. The release order is: merge with the gate green, migrate, deploy the API, smoke, deploy the frontend, smoke again. Rollback is redeploying the previous deployment on each platform; migrations only add things, so it needs no database rollback. Statements about platform plans and limits are marked UNVERIFIED there.

## API and AI design and limits

Interactive documentation is on in development; in production it is off, and [`backend/docs/openapi.json`](backend/docs/openapi.json) is the contract. Six endpoints were added to the Task 3 API: `POST /auth/refresh`, `POST /auth/logout`, `GET /ai/status` and three `POST /ai/projects/{projectId}/…` calls (`task-suggestions`, `prioritization`, `summary`).

- **Who can read what.** A person sees a project if they own it, hold a task in it, or are a lead; anything else is a 404. An email is shown only to its owner and to leads.
- **Sessions.** Access tokens last 15 minutes; refresh tokens last 7 days, work once and rotate. Using a used one revokes the whole session. Logout revokes it and is safe to repeat.
- **The AI pipeline** has ten steps: authorize, check the quota, commit a `pending` usage row, load the minimum data, build a versioned prompt, call the provider, validate (one repair attempt, only when time allows), post-process, record, respond. Prompts carry aliases (`T1`, `T2`), relative dates and no names, emails, tokens or identifiers; what people wrote is escaped and delimited as untrusted data. Output is requested against a schema and limited (at most 10 tasks, titles up to 120 characters, and so on); an identifier not in the input is dropped and a title the project already has is not suggested. The model gets no tools and the endpoints write nothing but a usage row.
- **Limits.** 20 AI calls per person per UTC day, 5 per minute, 500 in total per day, kept in the database so they survive restarts; over a limit is a 429 with `Retry-After`. Usage rows hold metadata only, never prompt or answer text, and are deleted after 90 days.
- **Live provider: Gemini** (ADR-424). The API talks to it behind an `LLMClient` interface with a deterministic fake for tests, the gate and demos.
- **Privacy.** Project text is sent to an external AI provider. The screens say so before first use. Review the provider's data-retention and training terms, and do not use confidential data in the demo.

## The gate

`make gate` runs the Task 2 and Task 3 gates and the Task 1 frontend gate first (the supersessions are listed in [`docs/supersession-log.md`](docs/supersession-log.md)), then `make test-auth` (sessions and isolation), `make test-ai` (the AI suites and the 20 adversarial fixtures), `make test-web` (types, unit and component tests), `make test-profile` and `make db-check` (registration, profile and migration 0008 on PostgreSQL), `make e2e-local` (the browser journey, axe and fault injection on the compose stack), `make e2e-profile` (the profile browser specs), `make security-full` (gitleaks, the built bundle, both audits, headers and cookies), `make deploy-check`, `make docs-check` and `make guide-check` (the compliance matrix, README sections, `.env.example` against Settings, gitleaks). After a deploy: `make smoke` and `make e2e-live`. Before submission: `make ai-eval` with your provider key. Open items are in [`docs/blockers.md`](docs/blockers.md).

## Demo script

The timed script for the recording is [`docs/submission/demo-script.md`](docs/submission/demo-script.md). The earlier Task 4 script is [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md): register, sign in, create a project, generate tasks with AI, edit and add them, change a status, show the dashboard, show one AI failure state, sign out. No secret is shown.

## Known limitations

- Email addresses are not verified and there is no password reset, because both need an email provider (ADR-605). Registration accepts an optional profile photo; changing an existing avatar and changing email remain unavailable in this version (ADR-426).
- A duplicate email is reported at registration, so the existence of an account can be learned.
- Companies are free text (ADR-602), and profiles are visible to signed-in members only (ADR-603).
- The rate limiter is per process, so the API runs as **one instance**. Behind the site every visitor shares one client address, so registration is limited to a few per minute for everyone; login is limited per email.
- Lists read up to 1000 rows and are filtered on the page; server-side paging in the screens is future work.
- AI providers process the text they receive; that is why minimisation is a hard rule.
- Refresh-token and usage tables rely on the periodic cleanup rule (30 and 90 days) to stay small; it is a method on the services, and scheduling it is an operator task.
- Row-level security in the database is a roadmap item.
- Open: the Task 1 first-load JavaScript budget (170 KB) is exceeded on every route (B-401 in [`docs/blockers.md`](docs/blockers.md)).
