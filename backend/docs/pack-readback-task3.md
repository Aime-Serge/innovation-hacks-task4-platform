# Task 3 pack read-back

Written before Phase 0, as the pack requires. It restates the requirements the implementation is held to. The full pack is in [standards/task3-standards-pack.md](standards/task3-standards-pack.md).

## Counts confirmed against the attachments

| Document | Sections | Functional | Non-functional | Other |
| --- | --- | --- | --- | --- |
| Task 3 pack | 12 | 26 (22 Must, 4 Should) | 25 | 4 tables, 6 referential actions, 13 ADRs (ADR-301 to ADR-313), 13 threats (TH-301 to TH-313) |
| Task 2 pack | 12 | 34 (25 Must, 9 Should) | 25 | 23 endpoint rows |
| Task 1 pack | not verifiable | not verifiable | not verifiable | The text extract in `docs/standards/` lost its tables, so the 24 and 24 could not be re-counted (ADR-321) |

## (a) Functional requirements

| ID | Pri | One-line paraphrase |
| --- | --- | --- |
| FR-301 | M | Persist users: Every user field of Task 2 section 8 is stored in `users`; data is intact after restarting both API and database |
| FR-302 | M | Persist projects: Every project field is stored in `projects`, and `progress` is not stored |
| FR-303 | M | Persist tasks: Every task field is stored in `tasks`, including `completed_at` |
| FR-304 | S | Persist activity: The feed of FR-221 reads from `activity` and survives restarts |
| FR-305 | M | Full CRUD with unchanged behaviour: Every Task 2 endpoint returns the same statuses, bodies, and errors on PostgreSQL; the whole Task 2 test suite passes with no test edited |
| FR-306 | M | Foreign keys with delete rules: All six relationships of section 3 exist with the stated actions, each indexed, each tested |
| FR-307 | M | Unique email at database level: Two emails that differ only by case cannot both be stored, even by direct SQL |
| FR-308 | M | Field constraints at database level: Lengths, enums, `https` avatar, lowercase email, and NOT NULL rules of section 6 are constraints; each has a bypass test |
| FR-309 | M | Status and completion consistency: A task is `done` if and only if `completed_at` is set, enforced by a constraint (BR-303) |
| FR-310 | M | Progress by aggregation: Project progress and dashboard totals come from one aggregate query per request; no counters are stored |
| FR-311 | M | Query semantics identical to Task 2: Search, filters, sort, and pagination run in SQL; a differential test shows identical results to the memory backend on the same data |
| FR-312 | M | Time from the injected clock: Overdue and upcoming logic receives today's date as a query parameter (BR-307) |
| FR-313 | M | Atomic multi-step operations: Task create, status change, task delete, and user delete each run in one transaction with their activity and unassignment effects; a forced failure leaves no partial data |
| FR-314 | M | Concurrency safety: Concurrent status changes on one task, concurrent demotions of leads, and a task creation racing a project deletion always end in a valid state (BR-306) |
| FR-315 | M | Database errors mapped to API errors: Constraint violations and connection failures become existing Task 2 codes (409, 422, 503); no SQL text, table name, or driver message reaches a client |
| FR-316 | M | Configuration from environment: `DATABASE_URL` and `MIGRATION_DATABASE_URL` are validated at startup; a missing or invalid value stops the app and names the variable; no credential appears in code, compose files, or docs |
| FR-317 | M | Least-privilege roles: The application role can read and write rows but cannot create, alter, or drop objects; only the migration role can |
| FR-318 | M | TLS required in production: With `APP_ENV=production` the app refuses a connection string without TLS and refuses `STORAGE_BACKEND=memory` |
| FR-319 | M | Reversible migrations: Alembic builds the full schema from an empty database; every revision has a working downgrade |
| FR-320 | M | Schema drift check: `alembic check` reports no difference between models and migrations; every constraint follows the naming convention |
| FR-321 | S | Seed on PostgreSQL: `python -m app.seed --profile <name>` loads `default`, `empty`, `large`, and `xl`; `--reset` works only outside production |
| FR-322 | M | Database-aware readiness: `GET /readyz` returns 200 only when a query succeeds and returns 503 otherwise |
| FR-323 | S | Pool and timeouts: Pool size, overflow, statement timeout, lock timeout, and idle-transaction timeout are configured from the environment with safe defaults |
| FR-324 | S | Backup and verified restore: `make db-backup` and `make db-restore-test` produce a dump, restore it into a scratch database, and match row counts and checksums |
| FR-325 | M | Local database with Docker Compose: One command starts PostgreSQL; the compose file reads the password from the environment and fails if it is unset |
| FR-326 | M | Schema documentation: An ERD and a data dictionary are generated from the live schema, committed, and checked for drift |

## (a) Non-functional requirements

| ID | Category | Requirement | Target | Verified by |
| --- | --- | --- | --- | --- |
| NFR-301 | Performance | p95 latency of list endpoints on the `xl` seed | 200 ms or less | Locust load test |
| NFR-302 | Performance | p95 latency of single-resource reads and writes | 100 ms or less | Locust load test |
| NFR-303 | Performance | Filter, join, and sort columns used by the endpoints are indexed | 0 full-table scans on `tasks` for indexed filters | EXPLAIN plan test |
| NFR-304 | Performance | No N+1 queries: list endpoints use a constant number of queries | 3 or fewer per request at any page size | Query-count test |
| NFR-305 | Reliability | No connection leaks after load | 0 connections checked out when idle | Pool statistics test |
| NFR-306 | Integrity | No orphaned rows after any test run, including fuzz and concurrency | 0 orphans | Orphan-scan SQL |
| NFR-307 | Integrity | Every defined constraint has a bypass test that expects rejection | 100% of constraints | Constraint matrix test |
| NFR-308 | Data types | `uuid`, `timestamptz` in UTC, `date`, and `text` with length checks as in section 6 | 100% of columns | Schema inspection test |
| NFR-309 | Durability | Data survives a restart of the API and of the database container | 0 rows lost | Restart test |
| NFR-310 | Migration safety | Migrations go up, down, and up again on an empty and on a seeded database | 100% success | Round-trip test |
| NFR-311 | Recoverability | A restore reproduces the data; documented objectives are RPO 24 hours and RTO 1 hour | Row counts and checksums equal | Restore test |
| NFR-312 | Availability | Database outage gives a clean 503 within 5 s and recovery within 30 s of the database returning, with no restart | Pass | Outage test |
| NFR-313 | Concurrency | READ COMMITTED isolation with explicit row locks where BR-306 needs them | 0 invalid end states in 200 racing runs | Concurrency tests |
| NFR-314 | Security | No credentials in the repository, history, compose files, images, or logs | 0 findings | gitleaks, log scan |
| NFR-315 | Security | The application role cannot run DDL | Permission denied on create, alter, drop | Privilege test |
| NFR-316 | Security | Production connections require TLS | Enforced at startup | Configuration test |
| NFR-317 | Security | All SQL is parameterised; search input is data | 0 string-built queries | ruff S608, bandit, injection-string test |
| NFR-318 | Security | `password_hash` is read only by the login lookup | 1 query | Query-capture test |
| NFR-319 | Maintainability | Only `repositories/sql` imports SQLAlchemy or the driver; ORM objects never leave it | 0 violations | import-linter |
| NFR-320 | Maintainability | ERD and data dictionary match the live schema | 0 differences | Documentation drift check |
| NFR-321 | Maintainability | Every constraint and index follows the naming convention; every migration is reversible | 100% | Naming lint, round-trip test |
| NFR-322 | Portability | The repository contract suite passes for the memory and SQL implementations | Identical results | Repository contract suite |
| NFR-323 | Testability | Tests use a disposable PostgreSQL container, never a shared or existing database | 100% | CI configuration |
| NFR-324 | Observability | Queries slower than 200 ms are logged with a fingerprint and duration, never with parameter values | All slow queries | Log test |
| NFR-325 | Compatibility | The exported `openapi.json` is unchanged from Task 2 apart from documented readiness details | 0 breaking differences | OpenAPI diff |

## (b) The four tables

**Table `users`**

| Column | Type | Null | Default | Constraints |
| --- | --- | --- | --- | --- |
| `id` | uuid | no | application-generated; `gen_random_uuid()` as fallback | `pk_users` |
| `name` | text | no | none | `ck_users_name_length`: 1 to 80 characters and equal to its trimmed value |
| `email` | text | no | none | `uq_users_email` unique; `ck_users_email_format`: equal to its lowercase value, at most 254 characters, contains `@` |
| `password_hash` | text | no | none | `ck_users_password_hash_present`: not empty |
| `role` | text | no | `developer` | `ck_users_role`: `developer` or `lead` |
| `avatar_url` | text | yes | none | `ck_users_avatar_url`: starts with `https://` and at most 2048 characters |
| `theme` | text | no | `system` | `ck_users_theme`: `light`, `dark`, or `system` |
| `created_at`, `updated_at` | timestamptz | no | `now()` as fallback | none |

**Table `projects`**

| Column | Type | Null | Default | Constraints |
| --- | --- | --- | --- | --- |
| `id` | uuid | no | as above | `pk_projects` |
| `name` | text | no | none | `ck_projects_name_length`: 1 to 80 characters, trimmed |
| `description` | text | no | empty string | `ck_projects_description_length`: at most 2000 |
| `status` | text | no | `planned` | `ck_projects_status`: `planned`, `active`, `on_hold`, `completed` |
| `due_date` | date | yes | none | none |
| `owner_id` | uuid | no | none | `fk_projects_owner_id_users`, on delete restrict |
| `created_at`, `updated_at` | timestamptz | no | `now()` as fallback | none |

**Table `tasks`**

| Column | Type | Null | Default | Constraints |
| --- | --- | --- | --- | --- |
| `id` | uuid | no | as above | `pk_tasks` |
| `project_id` | uuid | no | none | `fk_tasks_project_id_projects`, on delete restrict |
| `title` | text | no | none | `ck_tasks_title_length`: 1 to 120 characters, trimmed |
| `description` | text | no | empty string | `ck_tasks_description_length`: at most 4000 |
| `status` | text | no | `todo` | `ck_tasks_status`: `todo`, `in_progress`, `in_review`, `done` |
| `priority` | text | no | `medium` | `ck_tasks_priority`: `low`, `medium`, `high`, `urgent` |
| `priority_rank` | smallint | no | generated from `priority`: urgent 4, high 3, medium 2, low 1 | generated column, stored (BR-309) |
| `due_date` | date | yes | none | none |
| `assignee_id` | uuid | yes | none | `fk_tasks_assignee_id_users`, on delete set null |
| `completed_at` | timestamptz | yes | none | `ck_tasks_completed_consistency` (below) |
| `created_at`, `updated_at` | timestamptz | no | `now()` as fallback | none |

**Table `activity`**

| Column | Type | Null | Default | Constraints |
| --- | --- | --- | --- | --- |
| `id` | uuid | no | as above | `pk_activity` |
| `actor_id` | uuid | no | none | `fk_activity_actor_id_users`, on delete cascade |
| `project_id` | uuid | no | none | `fk_activity_project_id_projects`, on delete cascade |
| `task_id` | uuid | yes | none | `fk_activity_task_id_tasks`, on delete set null |
| `type` | text | no | none | `ck_activity_type`: `created`, `status_changed`, `completed` |
| `at` | timestamptz | no | `now()` as fallback | none |

**Excerpt: the `tasks` table as SQL**

```sql
CREATE TABLE tasks (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  project_id    uuid        NOT NULL,
  title         text        NOT NULL,
  description   text        NOT NULL DEFAULT '',
  status        text        NOT NULL DEFAULT 'todo',
  priority      text        NOT NULL DEFAULT 'medium',
  priority_rank smallint    GENERATED ALWAYS AS (
                  CASE priority WHEN 'urgent' THEN 4 WHEN 'high' THEN 3
                                WHEN 'medium' THEN 2 ELSE 1 END) STORED,
  due_date      date,
  assignee_id   uuid,
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_tasks PRIMARY KEY (id),
  CONSTRAINT fk_tasks_project_id_projects
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE RESTRICT,
  CONSTRAINT fk_tasks_assignee_id_users
    FOREIGN KEY (assignee_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT ck_tasks_title_length
    CHECK (char_length(title) BETWEEN 1 AND 120 AND title = btrim(title)),
  CONSTRAINT ck_tasks_description_length CHECK (char_length(description) <= 4000),
  CONSTRAINT ck_tasks_status
    CHECK (status IN ('todo', 'in_progress', 'in_review', 'done')),
  CONSTRAINT ck_tasks_priority
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  CONSTRAINT ck_tasks_completed_consistency
    CHECK ((status = 'done') = (completed_at IS NOT NULL))
);
```

**Indexes.** Every foreign key column has an index, and each other index exists for a named query. The `pg_trgm` extension is created by the migration role.

| Index | Definition | Serves |
| --- | --- | --- |
| `uq_users_email` | unique on `users (email)` | Login lookup, duplicate rejection |
| `ix_users_role` | `users (role)` | Last-lead check |
| `ix_projects_owner_id` | `projects (owner_id)` | Owner filter, restrict check |
| `ix_projects_status` | `projects (status)` | Status filter |
| `ix_projects_name_trgm` | GIN trigram on `projects (name)` | Search |
| `ix_tasks_project_id_status` | `tasks (project_id, status)` | Project detail, progress, restrict check |
| `ix_tasks_assignee_id_status` | `tasks (assignee_id, status)` where assignee is not null | Assignee filter, set-null lookup |
| `ix_tasks_due_date_open` | `tasks (due_date)` where status is not `done` | Overdue and upcoming deadlines |
| `ix_tasks_due_date_id` | `tasks (due_date, id)` | Sort by due date |
| `ix_tasks_priority_rank_id` | `tasks (priority_rank DESC, id)` | Sort by priority |
| `ix_tasks_title_trgm`, `ix_tasks_description_trgm` | GIN trigram | Search |
| `ix_activity_at_id` | `activity (at DESC, id DESC)` | Activity feed |
| `ix_activity_actor_id`, `ix_activity_project_id`, `ix_activity_task_id` | one per foreign key | Cascade and set-null lookups |

## (c) The six referential actions

| Relationship | On delete of the parent | Why |
| --- | --- | --- |
| `projects.owner_id` to users | Restrict | A user who owns projects cannot be deleted (BR-207) |
| `tasks.project_id` to projects | Restrict | A project that has tasks cannot be deleted (BR-206) |
| `tasks.assignee_id` to users | Set null | Deleting a user unassigns their tasks (BR-207) |
| `activity.project_id` to projects | Cascade | History of a deleted, empty project has no meaning |
| `activity.actor_id` to users | Cascade | The feed shows people who exist; audit history is a roadmap item |
| `activity.task_id` to tasks | Set null | The feed entry stays, and `taskId` is already optional in the API |

## (d) Constraint-to-error translation

| Database event | API result |
| --- | --- |
| `uq_users_email` violated | 409 `EMAIL_ALREADY_EXISTS` |
| Delete blocked by `fk_tasks_project_id_projects` | 409 `PROJECT_NOT_EMPTY` |
| Delete blocked by `fk_projects_owner_id_users` | 409 `USER_OWNS_PROJECTS` |
| Insert or update violating `fk_tasks_project_id_projects` or `fk_tasks_assignee_id_users` | 422 `VALIDATION_ERROR` naming `projectId` or `assigneeId` |
| Any `ck_` constraint violated | 422 `VALIDATION_ERROR` with a generic field message; logged as a defect because application validation should have caught it |
| Deadlock, lock timeout, or statement timeout after retries | 503 `SERVICE_UNAVAILABLE` |
| Connection refused, pool exhausted, or server unavailable | 503 `SERVICE_UNAVAILABLE` |
| Any other database error | 500 `INTERNAL_ERROR`, logged with the request ID; no SQL or driver text in the response |

## (e) Environment variables

| Variable | Purpose | Required | Notes |
| --- | --- | --- | --- |
| `APP_ENV` | `development`, `test`, or `production` | Yes | Drives the production refusals below |
| `STORAGE_BACKEND` | `sql` or `memory` | Yes | `memory` is rejected when `APP_ENV=production` |
| `DATABASE_URL` | Application role connection | When `sql` | Form: `postgresql+asyncpg://ih_app:<password>@<host>:5432/<database>`; must require TLS in production |
| `MIGRATION_DATABASE_URL` | Migration role connection | For migrate only | Absent from the running API's environment in production |
| `DB_POOL_SIZE`, `DB_MAX_OVERFLOW`, `DB_POOL_TIMEOUT_S` | Connection pool | No | Defaults 10, 10, 5 |
| `DB_STATEMENT_TIMEOUT_MS` | Longest query allowed | No | Default 5000 |
| `DB_LOCK_TIMEOUT_MS` | Longest wait for a lock | No | Default 2000 |
| `DB_IDLE_TX_TIMEOUT_MS` | Idle-in-transaction limit | No | Default 10000 |
| `POSTGRES_PASSWORD` | Administrator password for the local container | Yes, compose | No default; compose fails if unset |
| `APP_DB_PASSWORD`, `MIGRATOR_DB_PASSWORD` | Passwords given to the two roles when they are created | Yes, compose | No defaults |

## (f) Contradictions and gaps between the packs and the existing code

Each has an ADR in `docs/adr/`.

| # | Finding | Decision | ADR |
| --- | --- | --- | --- |
| 1 | The pack allows two additive protocol changes (`for_update`, `UnitOfWork`), but its own query patterns (progress for a page in one aggregate, dashboard totals in one query, `xl` bulk seed) need four more methods | Add `progress_for_many`, `totals`, `count` and `add_many` to the protocols and to both backends. No existing method changes | ADR-314 |
| 2 | NFR-318 says `password_hash` is read only by the login lookup, but Task 2's repository contract test asserts `get(id) == user` for an object that carries a hash | The hash is excluded from equality and repr of the domain `User`, and every read except the login lookup returns it blank. The test is unchanged | ADR-315 |
| 3 | `STORAGE_BACKEND` is "Required: Yes", but Task 2 tests, the Task 2 demo and a first local run have no database | Default `memory` outside production; production refuses `memory`, so an unset value stops the app there | ADR-316 |
| 4 | "No Task 2 test may change", but the tests need a way to choose the backend, a memory-only seed test reads `container.tasks_repo`, and a production-mode test now needs a SQL setting | `--backend` option, one seed test reads through the unit of work, and the test helper supplies a placeholder SQL setting for production apps. No assertion changes | ADR-317 |
| 5 | The pack says `backend/` and `database/` in a monorepo; this is a standalone repository (as in Tasks 1 and 2) | `app/`, `migrations/`, `tests/` at the root and `database/` beside them | ADR-318 |
| 6 | The pack names the branch `task/3-database`, which already exists on GitHub from the first implementation | The rebuild lives on `task/3-standards-pack`; the old history is kept | ADR-319 |
| 7 | The pack lists `ih_readonly` but no password variable and no place for its column grant | `READONLY_DB_PASSWORD` for the role script, and the grant in revision `0003` | ADR-320 |
| 8 | The Task 1 pack extract is lossy, so its counts cannot be re-verified | Recorded as a gap; Task 1 compatibility is checked against the dashboard's own types | ADR-321 |
| 9 | Activity tie-breaks by id descending in the index but ascending in the memory backend | Memory changed to id descending, so both backends and the index agree | ADR-322 |
| 10 | Text sorts use the database locale, the memory backend sorts by code point | Sort `lower(x) COLLATE "C"` | ADR-323 |
| 11 | The pack counts a list's total with a second query, which with authentication makes 4 queries for a project list against the limit of 3 | A window count returns the rows and the total in one query | ADR-324 |
| 12 | A first implementation of Task 3 is deployed and its repository exists | Replaced on a new branch with history kept; the old API contract is not preserved | ADR-325 |
