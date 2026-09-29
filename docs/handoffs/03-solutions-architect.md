# Handoff Artifact: Solutions Architect → Backend/Database/Frontend/AI Engineers

Inspected before designing: Task 3's `app/security.py` (PBKDF2-SHA256
password hashing, 260k iterations), `app/config.py` (`secret_key`/
`database_url` already reserved as Task 4 placeholders), `app/routers/*`
(auth deliberately left as empty `dependencies=[]` hooks), and Task 1's
`lib/mock-data.ts`/`lib/useAsync.ts` (the exact 3 files that import it —
`DashboardView`, `ProjectDetailView`, `ProfileMenu` — and its own comment
confirming the intended swap seam).

## Auth Design

**Approach: JWT in an httpOnly cookie, with an `Authorization: Bearer`
fallback for non-browser clients.**

Justification against the existing stack:
- The frontend and backend are deployed to different origins (Vercel +
  Render) — a stateless, signed token avoids standing up a server-side
  session store (Redis, a sessions table) just for Task 4.
- httpOnly cookie transport — not `localStorage` — means the frontend's
  JS never touches the raw token in the normal browser flow, which is the
  main mitigation against token theft via XSS.
- Cross-origin cookies work here via `SameSite=None; Secure` in
  production (both origins are HTTPS) with the backend's CORS configured
  with `allow_credentials=True` and an explicit origin list (never `*`
  — required for credentialed CORS anyway).
- `SECRET_KEY` was already a reserved-but-unused Task 3 config field —
  this is its first real consumer, no new config plumbing needed.
- Library: PyJWT, HS256. Expiry: 24h access token, no refresh token — a
  deliberate simplification for an internship capstone (documented, not
  hidden); a production system would add short-lived access + rotating
  refresh tokens.

**Password hashing: switching to Argon2id** (`argon2-cffi`), replacing
Task 3's inherited PBKDF2-SHA256/260k implementation. PBKDF2 at 260k
iterations is not broken, but it sits below OWASP's current minimum
guidance for PBKDF2 specifically (~600k iterations), while this role's
brief explicitly calls for bcrypt/argon2 and Argon2id is OWASP's current
top recommendation (memory-hard, GPU/ASIC-resistant). `password_hash`
stays a plain `String(255)` column — algorithm-agnostic, no migration
needed. Passwords are never logged: no request/response body logging
exists anywhere in the app, and the one place a raw exception could leak
one (the global 500 handler) already returns a generic body with no
request data.

## Route Guard Design

**Backend — dependency injection, not global middleware.** FastAPI's
per-router `dependencies=[Depends(get_current_user)]` is used instead of
ASGI middleware, because middleware runs before routing and can't
distinguish "this path needs auth" without a hardcoded path list;
router-scoped dependencies express that naturally. Applied to `/users`,
`/projects`, `/tasks`, and `/projects/{id}/ai/*`; explicitly *not* applied
to `/auth/register` and `/auth/login` (which must be reachable
unauthenticated) or `/health`.

Authorization is a second, explicit layer inside each handler — "logged
in" is necessary but not sufficient. Every project/task read or write
also checks resource ownership. Cross-tenant access returns **404, not
403** (a project/task belonging to someone else looks identical to one
that doesn't exist — no resource-existence leakage). 403 is reserved for
same-identity-class-wrong-actor cases where existence isn't secret (e.g.
"you can't edit *this* user account, but you can see it exists via
`GET /users`").

**Frontend — Next.js Edge Middleware + client-side re-check.**
`middleware.ts` checks only for the *presence* of the `access_token`
cookie on protected path patterns (`/`, `/projects/:path*`) and redirects
to `/login?next=...` if absent — a cheap presence check, not JWT
verification (the signing secret must not be duplicated into edge
config). The real authorization decision is always re-made by the API on
every request. An `AuthProvider` client context additionally hydrates the
session via `GET /auth/me` on mount; a 401 there (e.g. an expired token
that's still present as a cookie) redirects client-side too.

## AI Feature Contract

**Acts on: Project** (not Task). Input is a project's name + description
+ optional user instructions; output is a list of *candidate* tasks the
user reviews and selectively creates — nothing is persisted by this call
itself.

```
POST /projects/{project_id}/ai/generate-tasks
Auth: required; 404 if the project doesn't exist or isn't the caller's.

Request:
{ "instructions"?: string (≤1000 chars), "count"?: int (1-8, default 5) }

Response 200:
{
  "source": "ai" | "fallback",
  "tasks": [{ "title": string, "description": string, "priority": "low"|"medium"|"high" }]
}
```

**Failure degrades in three handled tiers — never a 5xx for "AI
unavailable," never a blank screen:**
1. No `ANTHROPIC_API_KEY` configured → skip the call, return fallback, 200.
2. Key present but the call fails (timeout, rate limit, provider 5xx,
   network error) → caught, logged as a warning (no prompt content or
   secrets in the log line), fallback returned, 200.
3. Call succeeds but the response doesn't match the expected structured
   shape → caught as a parse failure, fallback returned, 200.

A real 5xx is reserved for genuinely unexpected bugs, already covered by
the existing global exception handler — "the AI provider is down" is an
*expected* condition with defined behavior, not an error.

## Integration Checklist

- [ ] Delete `lib/mock-data.ts`'s static arrays and its `delay()`/
      `simulateError` simulation entirely — no shipped code path may
      import or call it.
- [ ] Replace its four functions (`fetchProjects`, `fetchProject`,
      `fetchTasks`, `fetchCurrentUser`) with real API calls in a new
      `lib/data.ts`, preserving names/shapes so the 3 existing consumers
      (`DashboardView`, `ProjectDetailView`, `ProfileMenu`) need minimal
      changes.
- [ ] Extend `lib/types.ts` (not replace): `Task` gains `description`,
      `assigneeId`; its existing `blocked` status value — already in the
      frontend's type but never backed by the API — is now real.
- [ ] Backend schema: `tasks.priority`, `tasks.due_date`,
      `tasks.assignee_id` (FK → users, `ON DELETE SET NULL`), and
      `task_status` gains `blocked`.
- [ ] Remove `DashboardView`'s dev-only "Simulate error" checkbox — it
      only existed to fake failures for the mock layer; real error states
      now come from real fetch failures.
- [ ] Add `NEXT_PUBLIC_API_URL` as the frontend's first-ever env var,
      with a new `frontend/.env.example`.
- [ ] Ship gate: `grep -rn "mock-data\|simulateError" frontend/app
      frontend/components frontend/lib` (excluding deleted/rewritten
      tests) returns zero matches before this is called done.
