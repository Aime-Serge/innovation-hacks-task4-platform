# Handoff Artifact: Backend/Database Engineer → Frontend Engineer, AI Engineer

Deviation from the suggested dependency list: used `PyJWT` + `argon2-cffi`
instead of `python-jose`/`passlib[bcrypt]` — same category of tool, per
the Architect's already-recorded decision (Argon2id over bcrypt/PBKDF2 per
current OWASP guidance; PyJWT is the lighter of the two JWT libraries and
is FastAPI's own commonly-recommended choice).

## Auth Endpoints As Implemented

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/register` | none | Argon2id-hashes the password, creates the user, issues a session (cookie + body token) |
| POST | `/auth/login` | none | 401 on bad credentials; runs verify() against a real dummy hash for unknown emails (constant-time) |
| POST | `/auth/logout` | none | clears the session cookie |
| GET | `/auth/me` | required | returns the current user |

Session: JWT (HS256, `SECRET_KEY`), httpOnly cookie (`access_token`,
`SameSite=Lax` dev / `None;Secure` prod), 24h expiry. Any protected
endpoint also accepts `Authorization: Bearer <token>` for non-browser
clients.

**Protected (all require a session):** `/users` (list/get any; patch/
delete self only, 403 otherwise), `/projects` (full CRUD, owner-scoped,
404 not 403 across tenants), `/tasks` (full CRUD + status + assign,
owner-scoped via the parent project).

## Schema Changes As Implemented

Migration `a1c3f9d2b7e4` (on top of Task 3's `bdd9fa7e777a`):
- `tasks.priority` — enum `task_priority` (low/medium/high), default medium
- `tasks.due_date` — nullable date
- `tasks.assignee_id` — nullable FK → `users.id`, `ON DELETE SET NULL`
- `task_status` enum gains `blocked` (4th value, matches the Task 1
  frontend's existing `TaskStatus` type)

`password_hash`, `owner_id` (projects → users), `project_id` (tasks →
projects) already existed from Task 3's original migration — unchanged
here.

## Verification status

`from app.main import app` imports cleanly and the OpenAPI schema
generates with no errors (confirmed via a direct TestClient request that
reached the real `register` handler and failed only on missing
`DATABASE_URL`, i.e. routing/DI/validation all work). **The full
DB-backed pytest run (migrations + all 6 test files against real
Postgres) is blocked in this session**: Docker is installed and the
`docker` group membership was added to the user, but this shell's
process tree predates that change and no `sg`/`newgrp` is available to
re-exec into it — it needs a fresh terminal/login on your end, or I'll
pick it up automatically at deploy time against Render's managed
Postgres. Flagging this now rather than reporting a test run that didn't
happen.

## Arranged Commit List

```
54c37e7 feat(auth): add password hashing and user registration endpoint
6e6fea9 feat(auth): add login endpoint and token issuance
ddbc460 feat(auth): add auth middleware protecting write routes
888767d feat(db): add owner/assignee references, priority, due_date fields
1d149de refactor(db): update repository layer for new fields/relationships
6d0c0ef test(auth): add auth flow tests
```
