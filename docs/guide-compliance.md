# Guide compliance matrix

Source: section 8 of `docs/standards/minimal-profile-pack.md` (49 rows, one per guide requirement), checked against `docs/standards/innovation-hacks-guide.pdf` and the repository on branch `feat/minimal-profile`.

**How to read the status**

| Status | Meaning |
| --- | --- |
| Pass | The feature exists and the evidence file was opened and contains the cited case. Most rows below record test results from `docs/baseline-final.md`; rows updated on 2026-09-22 additionally record commands actually run that day against a live `docker compose up` stack (migration 0008, registration, profile, picker, privacy switch, screenshots), noted in the row. |
| Partial | Part of the requirement is met; the note names what is missing or still in progress on this branch. |
| Fail | Not met. None is recorded now. |
| Manual step | Only the author can complete it (deployment, video, post, releases, deadlines, attestation). |

`make guide-check` verifies that every evidence path below exists and that every TC id cited appears in a test file. It does not judge the status. TC ids are kept only where they were found in `backend/tests` or `frontend/tests`; MT ids are the profile tests of the pack, which are being written on this branch, so they appear only in notes.

Summary: see the counts at the end of this file.

## Task 1: Modern frontend (guide section 03)

| ID | Guide requirement | Satisfied by | Status | Evidence | Note |
| --- | --- | --- | --- | --- | --- |
| G-01 | Dashboard as the primary landing view | Dashboard route `/`; Task 1 FR-01 to FR-04 | Pass | `frontend/tests/e2e/auth.spec.ts`, `frontend/tests/unit/dashboard.test.tsx`, `frontend/docs/screenshots/01-dashboard-desktop.png`; TC-001 | Task 1 tests and screenshot exist. Test results as of the baseline (`docs/baseline-final.md`); re-run in the integration phase. |
| G-02 | Navigation bar with accessible wayfinding | Navigation and the new avatar menu; Task 1 FR-05 to FR-08, MF-18 | Pass | `frontend/tests/e2e/navigation.spec.ts`, `frontend/tests/unit/shell.test.tsx`, `frontend/tests/live/profile.spec.ts` ("MF-18, MT-16"); TC-010 to TC-012 | Built and verified live on 2026-09-22: the avatar menu shows the composed headline and never the email (checked against the real DOM, not a mock). |
| G-03 | User and profile section | Profile page, editor, and settings; MF-06 to MF-08, MF-12 | Pass | `frontend/src/app/(app)/profile/page.tsx`, `frontend/src/app/(app)/settings/page.tsx`, `frontend/tests/unit/settings.test.tsx`, `docs/screenshots/task-4/06-profile-desktop.png`, `docs/screenshots/task-4/07-settings-desktop.png` | Verified live on 2026-09-22 against the compose stack: the profile page, editor and four-tab settings render real data and were screenshotted (MT-06, MT-08). |
| G-04 | Project and task cards with a consistent visual system | Card components on design tokens; Task 1 FR-11, FR-12 | Pass | `frontend/tests/e2e/tasks.spec.ts`, `frontend/tests/unit/dates.test.ts`; TC-030, TC-031 |  |
| G-05 | Progress indicators for tasks and projects | Progress bar and ring; Task 1 FR-13 | Pass | `frontend/tests/unit/query-logic.test.ts`, `frontend/tests/unit/ui.test.tsx`; TC-040, TC-041 |  |
| G-06 | Search and filter | Filters kept in the URL; Task 1 FR-15 to FR-19 | Pass | `frontend/tests/e2e/tasks.spec.ts`, `frontend/tests/unit/query-logic.test.ts`; TC-050 to TC-054 |  |
| G-07 | Fully responsive on mobile, tablet, and desktop | Mobile-first layouts; Task 1 FR-23 | Pass | `frontend/tests/e2e/responsive.spec.ts`, `frontend/tests/live/profile.spec.ts`; TC-060, MT-19 | The profile, settings and assignment screens are covered at desktop and mobile widths by the live profile journey and the 18 captured Task 4 screenshots. |
| G-08 | Loading and empty states for all dynamic views | Skeletons, empty and error states; Task 1 FR-20 to FR-22 | Pass | `frontend/tests/e2e/states.spec.ts`, `frontend/tests/unit/dashboard.test.tsx`, `frontend/tests/live/profile.spec.ts`; TC-070 to TC-073 | Existing state coverage remains green; profile and settings screens were exercised against the live compose stack. |
| G-09 | Clean, reusable component architecture | Layering rules and boundary lint; Task 1 section 7 | Pass | `frontend/tests/unit/security.test.ts`; TC-080, TC-082, TC-083 | TC-081 does not appear in any test file, so it is not cited. |

## Task 2: Backend and REST API (section 04)

| ID | Guide requirement | Satisfied by | Status | Evidence | Note |
| --- | --- | --- | --- | --- | --- |
| G-10 | User management endpoints | Task 2 FR-201 to FR-208, plus `/me` endpoints | Pass | `backend/tests/api/test_auth_users.py`, `backend/tests/api/test_profile.py`; TC-201, TC-208 | The `/me` endpoints (GET /me, PATCH /me/profile, PUT /me/skills, PUT /me/preferences, PUT /me/privacy, POST /me/password, DELETE /me/sessions, POST /me/delete) are implemented and tested; `backend/tests/api/test_profile.py` and `backend/tests/db/test_profile_constraints.py` (99 tests) were re-run in this session and passed. |
| G-11 | Project creation and retrieval | Task 2 FR-209 to FR-213 | Pass | `backend/tests/api/test_projects_tasks.py`; TC-210 |  |
| G-12 | Task creation, update, and deletion | Task 2 FR-214 to FR-218 | Pass | `backend/tests/api/test_projects_tasks.py` | The test file exists; its TC ids are checked by `make guide-check`. |
| G-13 | Task status management | Enforced workflow; Task 2 FR-219 | Pass | `backend/tests/api/test_projects_tasks.py`; TC-233 |  |
| G-14 | Centralized error handling | One envelope and handlers; Task 2 FR-224 | Pass | `backend/tests/api/test_platform.py`; TC-240 |  |
| G-15 | Input validation on all write operations | Schemas with `extra="forbid"`, including the new endpoints | Pass | `backend/tests/contract/test_schemathesis.py`, `backend/tests/api/test_platform.py`, `backend/tests/api/test_profile.py`; TC-250, TC-253 | The new endpoints validate with `extra="forbid"` and are tested. One pre-existing, unrelated schemathesis case still fails in the baseline (undocumented 400 on the AI task-suggestions endpoint, B-F1 in `docs/blockers.md`), not caused by this work. |
| G-16 | Correct, meaningful HTTP status codes | Status-code decision table; Task 2 FR-226 | Pass | `backend/tests/api/test_platform.py`; TC-262 |  |
| G-17 | Environment variables for configuration and secrets | Validated settings and `.env.example`; Task 2 FR-227 | Pass | `.env.example`, `backend/.env.example`, `backend/app/core/config.py`; TC-270, TC-272 | `MIN_AGE` (16) and `TERMS_VERSION` (2026-09) are declared in `backend/app/core/config.py`'s `Settings`, `.env.example` and the README's environment table. `make guide-check`'s settings-match check was run in this session. |
| G-18 | Clear API documentation | `docs/openapi.json`, Postman collection, README; Task 2 FR-228 | Pass | `backend/docs/openapi.json`, `backend/postman/devdash.postman_collection.json`, `backend/tests/contract/test_openapi_document.py`; TC-280 | The OpenAPI file was regenerated after the new endpoints landed; `python scripts/export_openapi.py --check` was re-run in this session and reported "openapi.json matches the app." |

## Task 3: Database integration (section 05)

| ID | Guide requirement | Satisfied by | Status | Evidence | Note |
| --- | --- | --- | --- | --- | --- |
| G-19 | User, project, and task data storage | PostgreSQL tables, plus `profiles` and `profile_skills` | Pass | `backend/migrations/versions/0008_minimal_profile.py`, `backend/tests/db/test_operations.py`, `backend/database/docs/data-dictionary.md`; TC-301 to TC-308 | Migration 0008 was run against a real PostgreSQL container in this session (`migrate` service log: "Running upgrade 0007 -> 0008"); `profiles` and `profile_skills` exist and are backfilled. |
| G-20 | Full CRUD across all entities | Task 3 FR-305 | Pass | `backend/tests/db/test_operations.py`; TC-310, TC-311 |  |
| G-21 | Data validation at the database level | Named constraints, including the new ones | Pass | `backend/tests/db/test_profile_constraints.py`, `backend/tests/db/test_integrity.py`; TC-303, TC-305, TC-307 | The new named constraints (discipline, seniority, employment status, employment details, country code, https links, age confirmation, the skill limit trigger) have a raw-SQL bypass matrix; re-run in this session, 99 tests passed. |
| G-22 | Relationships between users, projects, and tasks | Foreign keys with delete rules | Pass | `backend/tests/db/test_integrity.py`; TC-320, TC-324 |  |
| G-23 | Secure database configuration with no hard-coded credentials | Environment-only URLs, separate roles, TLS in production | Pass | `backend/tests/db/test_security.py`, `docker-compose.yml`, `render.yaml`; TC-330, TC-337 | Production TLS is configured but not yet verified on a live database (see G-30). |
| G-24 | Repository includes the schema and models | Migrations, models, ERD, and data dictionary | Pass | `backend/migrations/versions/0008_minimal_profile.py`, `backend/database/docs/erd.mmd`, `backend/database/docs/data-dictionary.md` | Migrations 0001 to 0008 present; the ERD and data dictionary were regenerated for the new tables (commit 87b2687). |

## Task 4: Final application (section 06)

| ID | Guide requirement | Satisfied by | Status | Evidence | Note |
| --- | --- | --- | --- | --- | --- |
| G-25 | Registration, login, logout, and protected routes | Task 4 FR-401 to FR-405, and MF-01 to MF-05 | Pass | `backend/tests/auth/test_sessions.py`, `frontend/tests/live/journey.spec.ts`, `frontend/tests/live/profile.spec.ts`; TC-402 to TC-408 | The two-step registration wizard (MF-01 to MF-05, S-A) was run against the live compose stack in this session: `tests/live/journey.spec.ts` (3 viewports) and `tests/live/profile.spec.ts` (5 tests) both pass, 10/10 together. |
| G-26 | Project overview, task statistics, progress, and recent activity | Task 4 FR-410 | Partial | `frontend/tests/unit/dashboard.test.tsx`, `frontend/tests/e2e/auth.spec.ts` | TC-420 does not appear in any test file, so it is not cited. Dashboard content is tested under TC-001. |
| G-27 | Create, edit, delete, and view project details | Task 4 FR-411 to FR-414 | Pass | `frontend/tests/live/journey.spec.ts`, `frontend/tests/unit/delete-ui.test.tsx`; TC-421 |  |
| G-28 | Create, assign, update status, priority, due dates, search, and filter | Task 4 FR-415 to FR-420, and the people picker MF-11 | Pass | `frontend/tests/e2e/tasks.spec.ts`, `frontend/tests/live/profile.spec.ts`; TC-422 | The people picker (MF-11, MT-10) was exercised live: search by name, the discipline/company summary, and assigning a task, verified across two real accounts in `tests/live/profile.spec.ts`. |
| G-29 | At least one AI capability in the product experience | Task generation, with prioritisation and summary; Task 4 FR-421 to FR-428 | Partial | `backend/tests/ai/test_ai_api.py`, `backend/tests/ai/test_ai_safety.py`, `docs/ai-evaluation.md`; TC-430, TC-442 | AI features and fake-provider tests exist. `docs/ai-evaluation.md` records the live evaluation as not yet run; the author runs `make ai-eval` with their own key. |
| G-30 | Deployed on a recommended platform | Vercel and Render from committed configuration; Task 4 FR-437 to FR-440 | Manual step | `render.yaml`, `frontend/vercel.json`, `docs/deploy-runbook.md` | Configuration is committed; deployment and `make smoke` are the author's steps. No live address is recorded here. |

## Submission and repository (sections 07 and 08)

| ID | Guide requirement | Satisfied by | Status | Evidence | Note |
| --- | --- | --- | --- | --- | --- |
| G-31 | GitHub repository link, mandatory, for each task | A release per task tag, linked from the README | Manual step | `README.md`, `docs/submission/release-notes.md` | Only the tag `task-3-baseline` exists. Releases are created by the author; v1.1.0 is proposed in the release notes and no tag has been created. |
| G-32 | Demo video link, mandatory | Uploaded video with a working public link | Manual step | `docs/submission/demo-script.md` | The video is not recorded. The README carries a placeholder. |
| G-33 | Live deployment link, optional | The Vercel address, delivered | Manual step | `README.md` | No live address is recorded. Optional item. |
| G-34 | LinkedIn post link, with Innovation Hacks tagged, mandatory | A public post tagging the official page, with its URL submitted | Manual step | `docs/submission/linkedin-post.md` | A draft with a placeholder for the exact page handle exists; it is not published. |
| G-35 | README.md with installation instructions | Root README, tested from a clean clone | Partial | `README.md` | Install steps exist. A clean-clone test (MT-22) has not been run. |
| G-36 | Technology stack and feature list | README sections | Pass | `README.md` | Opened: the README has a Technology stack and a Features section tied to the guide. |
| G-37 | Screenshots | `docs/screenshots/task-N/`, embedded in the README | Pass | `README.md`, `docs/screenshots/task-4/` (18 files), `scripts/screenshots.ts` | Run in this session against the live compose stack: 18 screenshots at 1440x900 and 390x844 covering login, register, dashboard, projects, tasks, profile, settings, member profile and the people picker. |
| G-38 | Environment variable instructions in `.env.example` with no real values | Placeholder-only example files | Pass | `.env.example`, `backend/.env.example` | Placeholders only (`<set-me>` or empty). The settings-match check in `make guide-check` (`MIN_AGE`, `TERMS_VERSION` included) was run in this session. |
| G-39 | Demo link in the repository | Top of the README | Partial | `README.md` | A demo-link row exists with the value `<pending>`; the video does not exist yet. |
| G-40 | Never upload keys, passwords, or credentials | gitleaks over files and history, ignored `.env` files | Partial | `.gitleaksignore`, `.gitignore`, `backend/tests/security/test_repo_hygiene.py` | `make guide-check` runs gitleaks through the docker image; it reported no findings on 2026-09-21 in this session (git history scan). Re-run on the final tree before submission, so the status stays Partial. |

## Demo, evaluation, and guidelines (sections 09 to 12)

| ID | Guide requirement | Satisfied by | Status | Evidence | Note |
| --- | --- | --- | --- | --- | --- |
| G-41 | Video of 2 to 5 minutes | A script timed to 2 to 5 minutes | Partial | `docs/submission/demo-script.md` | The script is timed on paper. The recorded length is not known until the author records it. |
| G-42 | Video shows the app end to end, main features, key technical details, and the final result | The script's four segments | Manual step | `docs/submission/demo-script.md` | The four segments are scripted; the recorded video is the evidence. |
| G-43 | Scored on the eight-criterion rubric | The self-review sheet from the submission standard | Partial | `docs/submission/self-review.md` | The submission standard is missing from the repository (GAP-09, ADR-616); the sheet uses the guide's rubric. Unfinished criteria are marked in it. |
| G-44 | Complete tasks within the assigned deadlines | The finishing plan of section 9 | Manual step | `docs/submission/release-notes.md` | The guide gives no dates. The author confirms deadlines with the organisers. |
| G-45 | Do not copy projects from tutorials or repositories | Original code, with the libraries and sources listed | Partial | `docs/how-it-works.md` | A Sources and libraries section exists. Only the author can attest to originality. |
| G-46 | AI tools are allowed, but the intern must understand the implementation | Understanding notes and review questions answered by the author | Manual step | `docs/how-it-works.md` | Review questions are written; the Author's answer fields are intentionally empty. |
| G-47 | Organised repositories, no exposed credentials, functional projects | Repository checklist, gitleaks, smoke test | Partial | `scripts/smoke.sh`, `scripts/guide_check.py`, `Makefile` | Tools exist. The baseline had one failing backend test and a Prettier failure (`docs/baseline-final.md`, `docs/blockers.md`); a clean gate run is not yet recorded. |
| G-48 | Professional communication | README, post, and release notes reviewed for tone and accuracy | Manual step | `README.md`, `docs/submission/linkedin-post.md`, `docs/submission/release-notes.md` | Needs the author's review. |
| G-49 | Reward review may consider GitHub activity and timely submission | A readable commit history in logical commits, tags, and on-time submission | Partial | `docs/submission/release-notes.md` | History is in logical commits on the feature branch. Tags and timing are the author's steps. |

## Counts

| Status | Rows |
| --- | --- |
| Pass | 30 |
| Partial | 10 |
| Fail | 0 |
| Manual step | 9 |
| Total | 49 |
