# Pack readback: Minimal Profile, Registration and Final Integration Pack

Read on 2026-09-21 against the guide (`docs/standards/innovation-hacks-guide.pdf`) and the repository at
branch `feat/minimal-profile` (cut from `feat/header-theme-toggle`, commit 4ee485b).

## Counts (verified from the attachments)

| Item | Expected | Found |
| --- | --- | --- |
| Pack sections | 9 | 9 (Purpose and scope rule; Minimal feature set; Registration and profile; Settings, people picker and navigation; Data model and API; Requirements and business rules; Tests and Standards Gate; Guide compliance matrix; Finalization plan) |
| MF (Must / Should) | 25 (22 / 3) | 25 (22 / 3: MF-09, MF-14, MF-17 are Should) |
| MN | 9 | 9 |
| MB | 8 | 8 |
| MT | 23 | 23 |
| G rows | 49 | 49 |
| ADR | 8 | 8 (ADR-601 to ADR-608) |
| Endpoint rows | 12 | 12 |
| Supersessions | 4 | 4 (S-A to S-D) |
| Guide sections | 14 | 14 |
| Rubric weights | 25, 20, 15, 15, 10, 5, 5, 5 | same, total 100 |
| Submission items | 4 (3 mandatory, live optional) | same |
| Demo duration | 2 to 5 minutes | same |

Earlier packs present in `docs/standards/`: Task 1 (pdf, txt), Task 2, Task 3, Task 4 (md, pdf).
**Missing: the submission standard** that the pack cites (G-43, section 9 step 7). See GAP-09.

## Requirements: paraphrase and target files

Paths are relative to the repository root. `B` = `backend/app`, `F` = `frontend/src`.

| ID | Paraphrase | Target files |
| --- | --- | --- |
| MF-01 | Two-step registration; per-step `POST /users/validate` creates nothing; final `POST /users` signs in | B/api/v1/users.py, B/schemas/users.py, F/features/auth/RegisterForm.tsx |
| MF-02 | All field rules on client, server and DB; lists from one file, OpenAPI enums | B/domain/lists.py (+ `backend/config/profile_lists.json`), migration, F/generated |
| MF-03 | Terms version, time, age confirmation stored; no birth date | B/services/users.py, profiles table |
| MF-04 | Duplicate email still 409 `EMAIL_ALREADY_EXISTS` | unchanged path; test |
| MF-05 | Dashboard welcome banner with completeness | F/features/dashboard/ |
| MF-06 | Own profile page: header, about, skills, links, stats, completeness, states | F/app/(app)/profile, F/features/profile/ |
| MF-07 | `/people/{id}` member page, privacy-aware, no email or stats, 404 page | F/app/(app)/people/[id] |
| MF-08 | Profile editor with per-field messages, 10 unique skills, https host-checked links | B/api/v1/me.py, F/features/settings/ |
| MF-09 (S) | Completeness percent and next step, owner only | B/services/profiles.py |
| MF-10 | Plain text everywhere; external links `noopener nofollow` | F/features/profile/ |
| MF-11 | People picker combobox, privacy-aware `GET /users` items | F/features/tasks/, B/api/v1/users.py |
| MF-12 | Settings, four tabs | F/app/(app)/settings |
| MF-13 | Change password; current required; other sessions end; wrong current is 403 | B/api/v1/me.py, B/services/session_service.py |
| MF-14 (S) | Sign out of all devices | same |
| MF-15 | Theme and time zone saved per account | `PUT /me/preferences` |
| MF-16 | Privacy switch applies at once | `PUT /me/privacy`, users list, users get |
| MF-17 (S) | Delete account with password; `USER_OWNS_PROJECTS` block | `POST /me/delete` |
| MF-18 | Avatar menu, no email | F/layout/UserMenu.tsx |
| MF-19 | Reversible migration, backfill, naming, drift clean | backend/migrations/versions/0008_minimal_profile.py (ADR-609) |
| MF-20 | Endpoints in `openapi.json`, types regenerate | backend/docs/openapi.json, F/generated/api-types.ts |
| MF-21 | Task 1 to 4 gates pass except S-A to S-D | supersession log |
| MF-22 | Compliance matrix with evidence | docs/guide-compliance.md |
| MF-23 | README, screenshots, `.env.example`, demo link | README.md, docs/screenshots |
| MF-24 | Demo script (2 to 5 min) and LinkedIn draft | docs/submission/ |
| MF-25 | Understanding notes with empty author answers | docs/how-it-works.md |
| MN-01 | axe 0, keyboard only | tests/live, tests/a11y |
| MN-02 | Registration under 2 minutes median | manual timed runs (Manual step) |
| MN-03 | Profile read p95 150 ms, LCP 2.5 s | tests/load, lighthouse |
| MN-04 | No excluded data categories; 0 leaks | schema review, privacy tests |
| MN-05 | Escaping, https, rate limits, no new secret | tests, gitleaks |
| MN-06 | Every rule a named constraint, bypass tested | backend/tests/db |
| MN-07 | Compatibility, additive OpenAPI | migration test, spec diff |
| MN-08 | Docs present | docs check |
| MN-09 | 0 services, 0 secrets, 1 migration | config review |

## Supersessions and the existing tests each will touch

| ID | Change | Existing tests touched (to be confirmed by running them) |
| --- | --- | --- |
| S-A | `POST /users` requires givenName, familyName, profile block, consent, age | every test that registers through the API or the shared helper (`backend/tests/conftest.py` build_env/seed, `tests/api/test_auth_users.py`, `tests/auth`, `tests/security`, `tests/ai`, `tests/contract`), frontend `RegisterForm`, mock auth adapter, `tests/e2e/auth.spec.ts`, `tests/live/journey.spec.ts`, `scripts/smoke.sh` |
| S-B | User object gains fields; `GET /users` items gain a professional summary | contract tests, `tests/contract/test_openapi_unchanged.py` (baseline refreshed), `frontend/tests/contract/adapter.test.ts` |
| S-C | Avatar menu without email | `frontend/tests/unit/shell.test.tsx`, `tests/e2e/navigation.spec.ts` |
| S-D | Mock adapter gains fields | `frontend/src/adapters/mock/*`, adapter parity test |

## Endpoints (under `/api/v1`)

POST /users (201; 409, 422, 429) · POST /users/validate (200; 422, 429) · GET /me (200; 401) ·
PATCH /me/profile · PUT /me/skills · PUT /me/preferences · PUT /me/privacy (200; 401, 422) ·
POST /me/password (204; 401, 403, 422, 429) · DELETE /me/sessions (204; 401) ·
POST /me/delete (204; 401, 403, 409, 422) · GET /users (items extended) · GET /users/{userId} (extended).

## Migration columns and constraint names

`users`: `given_name`, `family_name` (nullable), constraints `ck_users_given_name_length`, `ck_users_family_name_length` (1 to 60 when present).
`profiles`: `pk_profiles`, `fk_profiles_user_id_users` (cascade), `ck_profiles_discipline`, `ck_profiles_seniority`,
`ck_profiles_employment_status`, `ck_profiles_company_name_length`, `ck_profiles_job_title_length`,
`ck_profiles_employment_details`, `ck_profiles_country_code`, `ck_profiles_city_length`,
`ck_profiles_time_zone_length`, `ck_profiles_headline_length`, `ck_profiles_about_length`,
`ck_profiles_github_url_https`, `ck_profiles_linkedin_url_https`, `ck_profiles_website_url_https`,
`ck_profiles_age_confirmed`; columns as in pack section 5.
`profile_skills`: `pk_profile_skills`, `fk_profile_skills_user_id_users` (cascade), `ix_profile_skills_user_id`,
`ck_profile_skills_name_length`, `uq_profile_skills_user_id_name_lower` (unique index on `user_id, lower(name)`),
constraint trigger enforcing at most 10 rows per user.

## Contradictions and gaps (each with an ADR)

| Gap | Finding | Decision |
| --- | --- | --- |
| GAP-01 | Pack names the migration `0006_minimal_profile`; the repository already has 0006 (ai_requests) and 0007 (visibility index). Pack text says "migrations up to 0005" | New revision is `0008` named `0008_minimal_profile`; down revision `0007`. ADR-609. Task 3 tables and migrations 0001 to 0007 untouched (F5) |
| GAP-02 | Pack says "ends every other session" on password change, but the access token carries no session id | `POST /me/password` accepts an optional `refreshToken` (the site server layer sends the cookie's value); every family except that token's family is revoked; if absent, all are. ADR-610 |
| GAP-03 | Pack calls `GET /me`; the API has `GET /auth/me` | Add `GET /me` (additive); keep `/auth/me` unchanged. ADR-611 |
| GAP-04 | Given and family names allow 60 characters each, but `users.name` allows 80 | The composed display name must be at most 80; longer combinations fail validation with a per-field message. The `users.name` constraint is unchanged. ADR-612 |
| GAP-05 | Pack section 5 says `users.theme` "stays where Task 3 put it" and `PUT /me/preferences` saves theme; existing `PATCH /users/{id}` also saves it | Both stay; `/me/preferences` is a thin wrapper over the same column. ADR-613 |
| GAP-06 | Repository has `forgot-password` and `reset-password` pages under `frontend/src/app/(auth)`; the pack defers password reset | Left untouched (F1, F6); check they do not depend on email; not extended. Recorded in ADR-605 note |
| GAP-07 | Existing `DELETE /users/{id}` is lead-only; pack adds self-service `POST /me/delete` | Both kept. ADR-614 |
| GAP-08 | Pack paths `backend/`, `database/`, `scripts/`; repository has `backend/database/`, root `scripts/` and `backend/scripts/`, and `docs/` at the root and in `backend/docs/` (OpenAPI lives in `backend/docs/openapi.json`) | Follow the repository; the root `docs/` holds the pack documents. ADR-615 |
| GAP-09 | Submission standard and its 8-criterion self-review sheet are not in `docs/standards/` | `docs/submission/self-review.md` uses the guide's rubric (section 10) directly. ADR-616 |
| GAP-10 | Pack matrix cites TC-### ids from earlier packs and MT-19/MT-20 style test names | `make guide-check` verifies evidence paths; TC ids are checked against the earlier packs' text where present, else the row is Partial |
| GAP-11 | Pack lists `make gate` targets `test-profile`, `db-check`, `e2e-profile`, `guide-check`, but the root Makefile has none, and `db-check` lives in `backend/Makefile` as `db-gate` | Create the four root targets; `db-check` wraps the backend targets |
| GAP-12 | Working tree base is `feat/header-theme-toggle`, not `main` | Kept as the base so the last UI work is included; noted for the PR |
| GAP-13 | Environment: no running database unless Docker is available to start one; the PostgreSQL test suite needs Docker | Baseline records what can run; SQL-backed tests marked as run or not run honestly |

## Guide facts used

14 sections; four submission items per task (repository, demo video, live link optional, LinkedIn post with Innovation Hacks tagged);
README, source, install steps, stack, features, screenshots, `.env.example`, demo link; demo 2 to 5 minutes; rubric weights 25/20/15/15/10/5/5/5;
guidelines include deadlines, no copying, understanding AI-assisted code, credentials never exposed.
