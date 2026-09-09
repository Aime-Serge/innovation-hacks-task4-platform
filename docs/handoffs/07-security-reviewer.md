# Handoff Artifact: Security Reviewer → Delivery Sign-off

Full review (not the light pass) given this task introduces authentication
and real user data. Methodology: an independent identification pass (agent,
read-only, full diff from the initial scaffold commit to HEAD) followed by
a separate false-positive-filtering pass on every candidate finding
(agent, applying a strict exclusion/precedent/confidence-scoring
protocol, include threshold 8/10) — plus my own direct evidence-gathering
for each of the five checklist items below, independent of what the
identification pass happened to flag.

## Full Security Review

### 1. Passwords: hashed, never logged, never returned — **PASS**

- Hashed with Argon2id (`argon2-cffi`, library defaults — OWASP's current
  top recommendation), not the PBKDF2 implementation Task 3 originally
  shipped. `app/security.py`.
- Never logged: grepped every `logger.*` call in `backend/app` — none
  reference password, password_hash, or token content. The two request-
  scoped log lines (`exceptions.py`, unhandled-exception handler) log only
  `request.method`/`request.url.path`.
- Never returned: `UserOut` (the only user-shaped response model used
  anywhere — `auth.py`, `users.py`) has no `password_hash` field.
  `UserInDB` (which does carry the hash) is never used as a
  `response_model`. Confirmed by reading every `response_model=` in
  `app/routers/`.

### 2. Auth tokens/sessions handled correctly — **PASS, after one fix**

- Session delivery is an httpOnly cookie (`app/routers/auth.py`,
  `_set_session_cookie`) — the frontend's JS never touches the token in
  normal use. Confirmed no `localStorage`/`sessionStorage` anywhere in
  `frontend/` (grepped `app/`, `components/`, `lib/`).
- The JSON body also returns `access_token` (for Postman/curl/the demo
  script, per the Architect's contract) — the frontend itself never reads
  or stores this; it relies purely on the cookie.
- **Found and fixed**: `SameSite=None; Secure` is required in production
  (frontend and backend are different origins), and `get_current_user()`
  accepted that cookie alone with no CSRF defense. See finding below —
  fixed in `8cab36e` before this sign-off.

### 3. Every write endpoint auth-gated, AND authorization (not just
   authentication) checked — **PASS**

- `dependencies=[Depends(get_current_user)]` on the `/users`, `/projects`,
  `/tasks`, and `/projects/{id}/ai` routers — verified every router file.
- Ownership, not just login, is checked on every project/task operation:
  `_get_owned_project`/`_get_owned_task` helpers (`projects.py`,
  `tasks.py`) compare `project.owner_id` to the caller's id before any
  read or write, returning 404 (not 403) for another user's resource so
  existence isn't leaked. `test_projects.py`/`test_tasks.py` assert this
  explicitly for every verb (get/list/patch/delete) with an `other_client`
  fixture representing a second, independent account.
- `assignee_id` may reference any user (not just the project owner) by
  design — this only lets a task *reference* another user's public
  id/name, never modifies their data; not an IDOR.

### 4. No hardcoded secrets; `.env.example` complete — **PASS**

- `SECRET_KEY`, `DATABASE_URL`, `ANTHROPIC_API_KEY` are all read via
  `get_settings()`; `SECRET_KEY` has no insecure default — `security.py`
  raises `RuntimeError` if it's unset, rather than silently signing with
  a fallback.
- Both `.env.example` files (`backend/`, `frontend/`) list every variable
  the app reads, with placeholder/blank values only.
- `docker-compose.yml`'s `POSTGRES_PASSWORD: devpassword` is a local-only,
  loopback-bound dev container (not a real secret, not reachable outside
  the host) — same pattern Task 3 already used, not a new exposure.

### 5. No dashboard/admin surface reachable unauthenticated — **PASS**

- Verified live, not just by reading code: unauthenticated `GET /` and
  `GET /projects/:id` both 307-redirect to `/login?next=...` via
  `proxy.ts`; `/login`/`/register` serve normally.
- Backend-side, every data endpoint requires `get_current_user` (see #3);
  `/health` is the only unauthenticated route and returns no user data.
- There is no admin role or admin surface in this app at all.
- `GET /users` returns name+email to any *authenticated* user (not
  unauthenticated) — deliberate, for the task-assignee picker; doesn't
  violate this item.

## Finding: CSRF on cookie-authenticated mutations (fixed)

Identified by an independent agent pass, then separately validated by a
second agent applying strict false-positive-filtering criteria
(confidence 8/10 — INCLUDE) before I acted on it.

- **Where**: `backend/app/main.py`, `backend/app/deps.py`,
  `backend/app/routers/auth.py` (cookie config).
- **Issue**: production cookies are `SameSite=None; Secure` (required —
  Vercel frontend, Render backend, different origins) with no CSRF
  token, custom-header check, or Origin/Referer validation. CORS's
  origin allowlist only gates whether cross-origin JS can *read* a
  response, not whether a CORS-simple request is sent at all — a hidden
  form (`enctype="text/plain"`, encoded so the body still parses as
  valid JSON) never triggers a preflight and would ride along with a
  victim's cookie.
- **Impact**: a logged-in victim visiting an attacker's page could have
  had `POST /projects` (needs no ID to guess) silently executed under
  their account.
- **Fix** (`8cab36e`): every mutating request now must carry
  `X-Requested-With: XMLHttpRequest` (`app/csrf.py`). A plain form can
  never set it; a real fetch/XHR request can, but that forces a CORS
  preflight, which the origin allowlist then rejects for any non-frontend
  origin — so the actual mutating request never reaches the backend from
  an attacker's page. `frontend/lib/api.ts` sends the header on every
  request. Verified directly (not just by reading the code): a POST
  without the header returns 403 with a clean error body; the same POST
  with the header passes the check and reaches the real handler; GET
  remains ungated. `test_csrf.py` locks in all three.

## Known limitation, not a blocker

No server-side session revocation: `/auth/logout` clears the cookie but
the JWT itself remains valid until natural expiry (24h) if a copy was
captured elsewhere. Flagged by the identification pass but excluded by
the filtering pass (confidence 3/10) — this is the standard, widely-
accepted tradeoff of stateless JWTs, and exploiting it requires the
token already having been captured through a separate compromise (XSS,
MITM, shared machine), not a distinct vulnerability this diff
introduces. Worth a comment for future work, not a gate on this release.

## Sign-Off Status: **CLEAR**

One real, concrete finding (CSRF) was identified, independently
validated, fixed, and the fix verified directly against a running
instance — not just read for plausibility. No other blocking issues
found across authentication, authorization, secrets management, or
unauthenticated surface exposure.

Outstanding non-blocking item carried into deployment: the full
Postgres-backed pytest suite (`test_csrf.py` included) still hasn't run
end-to-end in this session — Docker access is blocked here (see the
Backend/Database Engineer handoff); it will run for real against Render's
managed Postgres during deployment, which is the next step.
