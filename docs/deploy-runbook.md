# Deploy runbook (FR-437 to FR-442, UC-414 to UC-416, NFR-425)

Everything below is done by you, in your accounts: nothing in this repository can deploy for you. Secrets are typed into the two dashboards or into your own shell; they are never written to a file or pasted into a chat. Statements about Render and Vercel that could not be checked against their current documentation are marked **UNVERIFIED**: check each one before you rely on it.

## 0. Before you start

- The gate is green on your machine: `make gate` (the parts that need no live URL).
- You have a Render account, a Vercel account and a Gemini API key.
- The repository is on GitHub (you push it; nothing here pushes).

**UNVERIFIED platform facts to check first**

| Fact this runbook assumes | Where to check |
|---|---|
| The plan names in `render.yaml` (`starter` web service, `basic-256mb` PostgreSQL) exist and suit you | Render pricing page |
| The web plan you choose does not sleep when idle; if it does, expect the "waking up" message (NFR-403) and set the uptime monitor (step 9) | Render docs on free and paid instances |
| A free Render database may expire after a fixed number of days; a paid plan does not | Render docs on PostgreSQL plans |
| Region `oregon` for both Render resources, and `sfo1` for Vercel functions, are the closest pair | Render regions, Vercel regions |
| The Vercel plan allows a function duration of at least 30 s (`maxDuration` on the AI route, section 8) | Vercel docs on function duration |
| Render's internal database hostname format and that external access can be limited to your IP | Render database page |
| The current Gemini model name for `LLM_MODEL`, and the provider's retention and training terms for your key | Google AI documentation |

## 1. Make the secrets (in your shell)

```bash
export JWT_SECRET="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"
export MIGRATOR_DB_PASSWORD="$(python3 -c 'import secrets; print(secrets.token_hex(16))')"
export APP_DB_PASSWORD="$(python3 -c 'import secrets; print(secrets.token_hex(16))')"
export READONLY_DB_PASSWORD="$(python3 -c 'import secrets; print(secrets.token_hex(16))')"
```

Keep them in a password manager. Use a different `JWT_SECRET` for staging and production.

## 2. Create the database and the API service (Render)

1. Render → New → Blueprint → choose the repository. It reads `render.yaml`: the API service `ih-api` and PostgreSQL 16 `ih-db`.
2. It asks for the `sync: false` values. Enter `JWT_SECRET`, `LLM_API_KEY`, `LLM_MODEL`. Enter a placeholder for `DATABASE_URL` and `CORS_ALLOWED_ORIGINS` for now; you set them in steps 5 and 8. The first deploy of the API will fail its health check until the database is ready: that is expected.
3. On the database page, allow external access **from your IP only**, and copy the **external** connection string.

## 3. Provision the database roles (your machine)

```bash
export ADMIN_DATABASE_URL='postgresql://<admin user>:<password>@<external host>/ih_platform?sslmode=require'
make db-provision        # creates ih_migrator, ih_app and ih_readonly
```

It prints only the database name and "Roles created".

## 4. Migrate (your machine, never the platform)

```bash
export MIGRATION_DATABASE_URL="postgresql+asyncpg://ih_migrator:${MIGRATOR_DB_PASSWORD}@<external host>/ih_platform?ssl=require"
CONFIRM_PROD=yes make db-migrate-prod     # alembic upgrade head, then prints 0007 (head)
```

`MIGRATION_DATABASE_URL` is never set on the Render service (FR-439). Then remove the external access rule from the database if the plan allows it.

## 5. Connect the API to the database (Render dashboard)

Compose `DATABASE_URL` for the `ih_app` role with the **internal** hostname, the async driver scheme and TLS (ADR-414):

```text
postgresql+asyncpg://ih_app:<APP_DB_PASSWORD>@<internal host>/ih_platform?ssl=require
```

Paste it into the service's environment, then Manual Deploy. Wait until `https://<api>/healthz` and `/readyz` both answer 200.

## 6. Deploy the frontend (Vercel)

1. Import the repository. Set the **Root Directory** to `frontend/`. Framework: Next.js (also in `frontend/vercel.json`).
2. Environment variables (Production and Preview, all server-only, none starting with `NEXT_PUBLIC_`):
   `API_BASE_URL=https://<api host>` and `SITE_URL=https://<your vercel domain>`. `BFF_TIMEOUT_MS` is optional (default 28000).
   Do **not** set `APP_ENV` or `ALLOW_INSECURE_COOKIES`: production refuses the insecure setting.
3. Deploy. Preview deployments must point at a staging API and database, never at production (section 8).

## 7. Allow the site to call the API (Render dashboard)

Set `CORS_ALLOWED_ORIGINS` to your Vercel address (no wildcard) and redeploy the API.

## 8. Verify (release order steps 4 and 6)

```bash
SITE_URL=https://<your vercel domain> make smoke       # register to logout, with timings
SITE_URL=https://<your vercel domain> make e2e-live    # journey and axe at three viewports
```

`make smoke` prints the p95 of its calls: the target for warm non-AI calls is 500 ms (NFR-402). Registration and login include password hashing on purpose and are slower; judge the others.

Check by hand: the same request id appears in the Vercel logs and the Render logs (NFR-422): the `x-request-id` response header of any call is searchable in both. The API has Swagger UI off (`DOCS_ENABLED=false`) and `openapi.json` is in the repository.

## 9. Monitor (FR-441)

Create an external uptime monitor (any service) that requests `https://<api>/healthz` every 5 minutes and alerts you by email on failure. On a plan that sleeps when idle this also keeps the API warm.

## 10. Evaluate the AI (before submission, and after any prompt change)

```bash
export LLM_PROVIDER=gemini LLM_API_KEY=<your key> LLM_MODEL=<the model name>
make ai-eval
```

Then rate the answers in `docs/ai-evaluation-ratings.csv` and record the mean rating in `docs/ai-evaluation.md`. Until you do, that file honestly says **not yet run**.

## 11. Rehearse the rollback once and record the time (FR-442, NFR-407)

| Step | Action | Time taken |
|---|---|---|
| API | Render → the service → Events → the previous successful deploy → Rollback (or redeploy that commit) | not yet rehearsed |
| Frontend | Vercel → Deployments → the previous production deployment → Promote to Production | not yet rehearsed |
| Check | `make smoke` passes again | not yet rehearsed |

The database is **not** rolled back by down-migrations. Migrations only add things, so the previous versions keep working on the newer schema (NFR-408); a restore from backup is only for data corruption. The target for both platforms together is 10 minutes or less.

## The release order every time (section 8)

1. Merge to `main` only through a pull request with the gate green.
2. `CONFIRM_PROD=yes make db-migrate-prod` (additive, so the old API keeps working).
3. Deploy the API on Render; wait for `/healthz` and `/readyz`.
4. `make smoke` against the site (it exercises the API).
5. Deploy the frontend on Vercel.
6. `make smoke` again against both.

A change that removes or renames something is split across two releases: add the new form and stop using the old one in the first, remove the old one in the second.

## Kill switches and emergencies

- **AI misbehaving or costing money:** set `AI_ENABLED=false` on the API and redeploy the API only. The AI actions disappear from the site without a frontend deploy (FR-431).
- **Abuse of registration:** set `REGISTRATION_ENABLED=false`. The register page then says so.
- **A leaked secret:** rotate it in the platform dashboard and redeploy. A leaked `JWT_SECRET` signs everyone out; a leaked `LLM_API_KEY` is revoked at the provider.

## Staging (recommended)

A second Render service and database, and Vercel Preview deployments pointing at it, and a separate `JWT_SECRET`. For zero-cost demos the API can run with `APP_ENV=development` and `LLM_PROVIDER=fake` (the fake provider is refused only when `APP_ENV=production`), but then it is not a production configuration. Staging never shares a database with production.
