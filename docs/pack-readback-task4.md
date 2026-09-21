# Task 4 pack readback

Source of truth: `docs/standards/task4-standards-pack.md` (12 sections). Generated from its tables so no requirement is mistranscribed; sections (b), (f) and (g) are hand-written.

## (a) Requirements

### Functional (44: 36 Must, 8 Should)

| ID | Requirement | Pri | Target UC |
|---|---|---|---|
| FR-401 | Registration screen and flow | M | UC-401 |
| FR-402 | Login screen and flow | M | UC-402 |
| FR-403 | Logout | M | UC-403 |
| FR-404 | Protected routes | M | UC-402 |
| FR-405 | Session cookies and silent refresh | M | UC-404 |
| FR-406 | Refresh endpoint | M | UC-404 |
| FR-407 | Refresh-token reuse detection | S | UC-404 |
| FR-408 | Visibility scoping | M | UC-405 |
| FR-409 | Directory minimisation | M | UC-408 |
| FR-410 | Dashboard on real data | M | UC-405 |
| FR-411 | Create project | M | UC-406 |
| FR-412 | Edit project | M | UC-406 |
| FR-413 | Delete project | M | UC-406 |
| FR-414 | Project detail | M | UC-406 |
| FR-415 | Create task | M | UC-407 |
| FR-416 | Assign tasks | M | UC-408 |
| FR-417 | Change status | M | UC-407 |
| FR-418 | Set priority and due date | M | UC-407 |
| FR-419 | Search and filter | M | UC-409 |
| FR-420 | Delete task | M | UC-407 |
| FR-421 | AI status and gating | M | UC-413 |
| FR-422 | Task generation endpoint | M | UC-410 |
| FR-423 | Task generation interface | M | UC-410 |
| FR-424 | Prioritisation endpoint | S | UC-411 |
| FR-425 | Prioritisation interface | S | UC-411 |
| FR-426 | Project summary | S | UC-412 |
| FR-427 | Provider abstraction | M | UC-410 |
| FR-428 | Structured output validation | M | UC-410 |
| FR-429 | Quotas | M | UC-413 |
| FR-430 | Usage records | M | UC-416 |
| FR-431 | Kill switch | M | UC-413 |
| FR-432 | Human confirmation | M | UC-410 |
| FR-433 | Prompt data minimisation | M | UC-410 |
| FR-434 | Prompt versioning | S | UC-416 |
| FR-435 | Server layer proxy | M | UC-404 |
| FR-436 | HTTP adapter and generated types | M | UC-405 |
| FR-437 | Render deployment from configuration | M | UC-414 |
| FR-438 | Vercel deployment configuration | M | UC-414 |
| FR-439 | Migration and release order | M | UC-414 |
| FR-440 | Smoke test and live journey | M | UC-414 |
| FR-441 | Monitoring | S | UC-416 |
| FR-442 | Rollback | S | UC-415 |
| FR-443 | Documentation | M | UC-414 |
| FR-444 | Demo data through the API | S | UC-416 |

### Non-functional (25)

| ID | Category | Requirement | Target | Verified by |
|---|---|---|---|---|
| NFR-401 | Performance | p95 latency of an AI call with a live provider, with progress shown and cancel available | 10 s or less | Live AI evaluation |
| NFR-402 | Performance | p95 latency of non-AI API calls as seen from the smoke test, service warm | 500 ms or less | Smoke test timings |
| NFR-403 | Performance | After idle, the first request completes, the interface shows a "waking up" message after 5 s, and it retries | Within 60 s | Delayed-upstream E2E test |
| NFR-404 | Performance | Largest Contentful Paint of the dashboard, mobile profile, deployed URL | 2.5 s or less | Lighthouse CI |
| NFR-405 | Resilience | With the provider down, quota used, or AI disabled, every non-AI feature works and AI screens show a clear state | 100% of non-AI flows | Fault-injection E2E |
| NFR-406 | Durability | No data lost across redeploys and rollbacks | 0 rows lost | Redeploy check on staging |
| NFR-407 | Recoverability | Previous version restored on both platforms | 10 minutes or less | Rehearsal record |
| NFR-408 | Release safety | The previous API release keeps working on the newly migrated schema | 100% of its tests pass | Compatibility run |
| NFR-409 | Security | Tokens are never readable by page JavaScript | 0 tokens in web storage or page scripts | Playwright storage inspection |
| NFR-410 | Security | HTTPS everywhere with HSTS; no mixed content | 100% | Header and E2E checks |
| NFR-411 | Security | Secrets only in platform environments; the AI key never in any browser bundle or the repository | 0 findings | gitleaks and bundle scan |
| NFR-412 | Security | Users cannot read or write each other's data outside BR-401 | 0 violations | Two-user isolation suite |
| NFR-413 | Privacy | Prompts contain no email, password data, token, or internal identifier | 0 occurrences | Prompt-builder tests |
| NFR-414 | Security | Prompt-injection fixtures cause no unvalidated write, oversized output, or rendered markup | 0 of 20 fixtures | Adversarial suite |
| NFR-415 | Security | Dependency scans of both stacks | 0 high or critical | npm audit, pip-audit |
| NFR-416 | Security | Security headers on the deployed site, including CSP with `connect-src 'self'` and `frame-ancestors 'none'` | All present | Header test on live URL |
| NFR-417 | AI quality | Structured-output validity after one repair attempt, 50 live runs | 98% or higher | AI evaluation |
| NFR-418 | AI quality | Usefulness rubric average on 10 sample projects, and no duplicates of existing titles | 4 out of 5 or higher | AI evaluation, manual rating |
| NFR-419 | AI cost | Output token limit, quotas, and usage records active for every call | 100% of calls | Quota and usage tests |
| NFR-420 | Quality | Task 1 quality bar on the deployed frontend including AI screens | 0 axe violations, keyboard operable, 360 to 2560 px | axe and E2E |
| NFR-421 | Integration | Full user journey on the deployed URLs | Passes at 3 viewports | Playwright |
| NFR-422 | Observability | One request ID flows from the browser call through the server layer and the API into logs | 100% of sampled requests | Log correlation test |
| NFR-423 | Regression | All Task 2 and Task 3 tests pass except the rows listed in section 1 | 100% | Regression run |
| NFR-424 | Compatibility | OpenAPI changes are additive apart from listed supersessions; generated types regenerate and compile | 0 breaking differences | OpenAPI diff, `tsc` |
| NFR-425 | Reproducibility | A new Vercel and Render setup from the README and committed configuration | 60 minutes or less | Documented dry run |

## (b) Supersessions and the existing tests each will touch

The exact tests are identified in Phase 2 by running the Task 2 and Task 3 suites after the change. Only a test that fails because of S1, S2 or S6 may change, and each change is logged in `docs/supersession-log.md`. This list is the expected scope, not a result.

| ID | Change | Expected scope |
|---|---|---|
| S1 | Read visibility (BR-401/402): owner, assignee or lead, otherwise 404 | Task 2 list and read tests that assume global reads, activity and dashboard totals |
| S2 | `email` only for self and leads; `string or null` | User read and list tests that assert `email` |
| S3 | Rotating refresh tokens and logout (BR-404) | None (Task 2 listed them out of scope) |
| S4 | Login gains `refreshToken`, `refreshExpiresIn` | Additive; a strict login-body equality test would need a note |
| S5 | Six new error codes | Error catalogue test, additive |
| S6 | Authorization matrix (TC-300) regenerated from section 6 | The matrix test and any read test that used a second user |
| S7 | Task 3 NFR-325 relaxed to additive | OpenAPI diff test |
| S8 | HTTP adapter in production, mock adapter for tests | None; the mock adapter stays |

## (c) New API and data surface

- Endpoints under `/api/v1`: `POST /auth/refresh` (200), `POST /auth/logout` (204, body carries the refresh token, no Bearer), `GET /ai/status`, `POST /ai/projects/{projectId}/task-suggestions`, `.../prioritization`, `.../summary` (all 200).
- Error codes: `REFRESH_TOKEN_INVALID` 401, `REGISTRATION_DISABLED` 403, `AI_DISABLED` 503, `AI_UNAVAILABLE` 503, `AI_BAD_RESPONSE` 502, `AI_QUOTA_EXCEEDED` 429 (+ `Retry-After`).
- `refresh_tokens`: id, user_id (FK cascade), family_id, token_hash (unique, length 64), expires_at (after created_at), used_at, revoked_at, created_at. Constraints `pk_refresh_tokens`, `fk_refresh_tokens_user_id_users`, `uq_refresh_tokens_token_hash`, `ck_refresh_tokens_token_hash_length`, `ck_refresh_tokens_expiry_after_creation`. Indexes `ix_refresh_tokens_user_id`, `_family_id`, `_expires_at`. No access for `ih_readonly`.
- `ai_requests`: id, user_id (FK set null), feature, status, provider, model (nullable), prompt_version, input_tokens, output_tokens, latency_ms, error_code, created_at. Constraints `pk_ai_requests`, `fk_ai_requests_user_id_users`, `ck_ai_requests_feature`, `ck_ai_requests_status`, plus length and non-negative checks. Indexes `ix_ai_requests_user_id_created_at`, `ix_ai_requests_created_at`.
- Index `ix_tasks_assignee_id_project_id` on `tasks (assignee_id, project_id)` where assignee is not null.

## (d) Environment variables

API (Render): `APP_ENV`, `STORAGE_BACKEND`, `DATABASE_URL`, `JWT_SECRET`, `ACCESS_TOKEN_TTL_S`, `REFRESH_TOKEN_TTL_S`, `CORS_ALLOWED_ORIGINS`, `REGISTRATION_ENABLED`, `DOCS_ENABLED`, `AI_ENABLED`, `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_TIMEOUT_S`, `LLM_MAX_OUTPUT_TOKENS`, `AI_DAILY_LIMIT_PER_USER`, `AI_PER_MINUTE_LIMIT`, `AI_GLOBAL_DAILY_LIMIT`, plus the Task 3 pool and timeout variables. `MIGRATION_DATABASE_URL` is never set on the service.

Frontend (Vercel, server-only): `API_BASE_URL`, `SITE_URL`, `BFF_TIMEOUT_MS` (default 28000). The proxy also needs a development-only setting to relax cookie prefixes over HTTP; production refuses it.

## (e) AI pipeline, limits and quotas

Ten steps: authorize, check quota, reserve a committed `pending` row, load minimal data (aliases T1, T2, relative dates), build the versioned prompt with delimited user text, call the provider (timeout 20 s, 1024 output tokens, one retry only on 429 or 5xx), validate (one repair attempt, only if 8 s or more of the 25 s budget remain, message only), post-process (map aliases, reject unknown ids, drop duplicate titles, clamp, strip control characters), record, respond. Nothing is saved.

BR-408 limits: up to 10 tasks; title 120; description 500; priority one of four; `dueInDays` integer 0 to 90 or null; reason 200; summary 800; up to 5 risks and 5 next steps of 200 each; no control characters. BR-409 quotas: 20 per user per UTC day, 5 per user per minute, 500 global per day. A `pending` row older than 2 minutes counts as failed.

## (f) Contradictions and gaps (each needs an ADR)

1. **Migration numbers.** The pack names `0003_refresh_tokens`, `0004_ai_requests`, `0005_visibility_index`. The Task 3 repo already has `0003_reporting_grants` and `0004_task_creation_order_index`. Decision: renumber to 0005, 0006, 0007, keep names and contents. Prompt rule F2 mentions only 0001 and 0002 as unchanged; 0003 and 0004 stay unchanged too.
2. **Refresh cookie SameSite.** FR-405 says `SameSite=Lax` for the session cookies; section 9 says `Strict` for the refresh cookie. Decision: `Strict` on the refresh cookie (stricter, path-limited to `/api/bff/auth`), `Lax` on the access cookie.
3. **Variable names.** The pack uses `JWT_SECRET` and `CORS_ALLOWED_ORIGINS`; Task 3 code uses `SECRET_KEY` and `CORS_ORIGINS`. Decision: adopt the pack's names, accept the old names as deprecated aliases for one release, and update the tables.
4. **Repository layout.** The pack wants a monorepo (`frontend/`, `backend/`, `database/`, `docs/`, root `render.yaml` and `docker-compose.yml`). The Task 3 code is a single-service repo, and Task 1 is a separate frontend repo. `innovation-hacks-task4-platform` already exists on `main` with an earlier, different build (Gemini provider, one AI feature, its own auth and no Task 3 code). Decision: build on `task/4-final` in that repo, move Task 3 into `backend/` and Task 1 into `frontend/`, leave `main` and its live deployment untouched, and do not push.
5. **AI provider.** The earlier Task 4 build uses Gemini; the pack specifies an `LLMClient` with an Anthropic implementation plus a fake. Decision: follow the pack; the model name comes only from `LLM_MODEL`.
6. **Task 1 pack text.** The extracted `task1-standards-pack.txt` yields 21 FR and 16 NFR IDs, not 24 and 24, so the extraction is lossy. Decision: continue (allowed by the prompt for Task 1), read the PDF and docx where a Task 1 detail is needed, and record it in an ADR.
7. **Task 2 gate.** The Task 3 repo already contains Task 2's behaviour, so its `make gate` runs both; the Task 2 repo is not run separately unless a difference shows up.

## (g) Only verifiable on live deployments

NFR-401 (live AI latency), NFR-402 (warm timings), NFR-403 (cold start), NFR-404 (deployed LCP), NFR-406 and NFR-407 (redeploy, rollback), NFR-410 and NFR-416 (headers on the live URL), NFR-417 and NFR-418 (live evaluation and human rating), NFR-421 (journey on live URLs), NFR-422 (request ID in both platforms' logs), NFR-425 (60-minute dry run), FR-437 to FR-442 as deployed, and gate parts F, G and H. Everything else can be proven locally on the Compose stack with the fake provider.
