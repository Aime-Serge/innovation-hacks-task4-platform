# Handoff Artifact: DevOps Engineer → Delivery Sign-off

**Gate check**: Security sign-off is Clear (`docs/handoffs/07-security-reviewer.md`)
— proceeding is authorized. The blocker below is credentials, not security.

## Deployment Target + Justification

**Render** (API + managed Postgres) + **Vercel** (frontend) — from the
recommended list, chosen because:
- Render's Blueprint spec (`render.yaml`, added this commit) provisions
  a web service *and* a Postgres database from one file, with Render
  injecting the connection string itself — the DB-connection env var
  never needs to be typed anywhere.
- Both have a free tier sufficient for a project this size (no billing
  required to stand this up).
- Vercel is zero-config for Next.js App Router — no build settings to
  get wrong.
- Splitting frontend/backend across two platforms matches the actual
  architecture (separate origins, which is exactly why the CSRF defense
  and cross-origin cookie config exist) rather than papering over it
  with same-origin hosting.

## Env Var Checklist (names only — no values, no exceptions)

**Backend (Render dashboard → Environment, i.e. its secret manager):**
- `DATABASE_URL` — auto-injected by Render from the Blueprint's database
  resource, not typed in by hand
- `SECRET_KEY`
- `CORS_ORIGINS`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `FRONTEND_URL` — not secret, but must be the real Vercel URL, not the
  localhost default, or password-reset links point nowhere reachable
- `APP_ENV`, `LOG_LEVEL` — non-secret, set directly in `render.yaml`

**Frontend (Vercel dashboard → Environment Variables):**
- `NEXT_PUBLIC_API_URL` — set to `/api` (same-origin proxy, see the README's
  Deployment section for why calling Render directly breaks login)
- `API_PROXY_TARGET` — the Render API URL, server-side only
- `NEXT_PUBLIC_API_DOCS_URL` — optional, the footer's API-docs link

Confirmed: none of these have a value anywhere in this repo.
`render.yaml` marks every secret `sync: false` — Render's own way of
saying "this lives in the dashboard, never in this file."

## Build/Start Commands + Health Check

| Service | Build | Start | Health check |
| --- | --- | --- | --- |
| Backend (Render) | `pip install -r requirements.txt && alembic upgrade head` | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` | `GET /health` → `{"status":"ok",...}` |
| Frontend (Vercel) | `npm install && npm run build` (auto-detected) | Vercel-managed | Vercel's own build-success check |

Root directory: `backend/` and `frontend/` respectively — this is a
monorepo, both platforms need that set explicitly during project import
(Render: Blueprint's `rootDir`, already in `render.yaml`; Vercel: the
"Root Directory" field in project settings, since `vercel.json` doesn't
control this for a dashboard-imported monorepo).

## Live URL + Smoke-Test Results

**Not run yet — here's the actual blocker, stated plainly:** I checked
this environment for Render/Vercel CLI tools and stored credentials —
neither exists (verified: no `vercel`/`render` binary, no `~/.vercel` or
`~/.render` config, no token env vars). Both platforms' account linking
(connecting this GitHub repo, provisioning the database, entering the
secrets above) happens through a browser-based login I can't complete
on your behalf — there's no interactive browser session tied to your
account available to me here.

This is a real, correctly-identified blocker, not a gap I'm papering
over: I'm not going to claim a live URL or smoke-test result I haven't
actually produced.

**Two ways to unblock, your call:**
1. **You do the account-linking**, following the exact steps in
   [Next Steps](#next-steps-for-you) below, then send me the resulting
   URLs — I'll run the live smoke test (register → login → create
   project/task → trigger AI → logout) against them myself and report
   real results.
2. **You give me API tokens** (Render API key, Vercel token) — same
   handling as the Gemini key: goes straight into a local, gitignored
   file, never echoed, never committed, and I'd suggest rotating them
   afterward since they'd pass through this chat. With tokens, I can
   drive both CLIs directly and get further before handing back to you
   for anything that still needs a browser (e.g. Render Blueprint sync
   on first connect sometimes still wants a dashboard click).

## Next Steps For You

**Render:**
1. render.com → New → Blueprint → connect the
   `innovation-hacks-task4-platform` GitHub repo → it should read
   `render.yaml` automatically.
2. When prompted, fill in `SECRET_KEY`, `CORS_ORIGINS`, `GEMINI_API_KEY`,
   `GEMINI_MODEL` (leave `CORS_ORIGINS` pointing at your Vercel URL once
   you have it — you can circle back and update it).
3. Deploy. Note the resulting API URL (`https://ih-task4-api.onrender.com`-shaped).

**Vercel:**
1. vercel.com → Add New → Project → import the same repo.
2. Set **Root Directory** to `frontend`.
3. Add env vars `NEXT_PUBLIC_API_URL` = `/api`, `API_PROXY_TARGET` = the Render URL from above.
4. Deploy. Note the resulting frontend URL.
5. Go back to Render and update `CORS_ORIGINS` to that Vercel URL,
   redeploy the backend so CORS actually allows it.

Send me both URLs (or the tokens) and I'll take it from there.

## Update (pre-deploy hardening)

Testing the app the way production runs it (production build, API in
`APP_ENV=production`) found two bugs that dev mode hides, both fixed
before deploying:

1. **Cross-domain session cookie.** The API's cookie belongs to
   `*.onrender.com`; the frontend's route guard runs on `*.vercel.app`
   and could never see it, so login would loop back to `/login`. Fixed by
   proxying `/api/*` through Next.js (`next.config.ts`).
2. **Stale prefetch cache.** Production builds prefetch links; the guard's
   logged-out redirect for `/` was cached and replayed after login. Fixed
   by using a full page load after login/register/logout.

Also added: `?next=` redirect validation (was an open redirect), a pinned
`PYTHON_VERSION`, and `python -m uvicorn` as the start command.
