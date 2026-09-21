# Handoff to Task 4

What Task 4 can rely on from the data layer, and how to extend it without breaking it.

## Extending the schema

- New tables arrive through **migrations only** (`migrations/versions/0005_...`), hand-written from
  `app/repositories/sql/models.py`, with a working downgrade. `make db-check` (Alembic drift, naming
  rules) and `make db-docs` (ERD and data dictionary) must be clean in the same commit.
- Name every constraint and index by the convention: `pk_`, `fk_<table>_<column>_<parent>`, `uq_`,
  `ck_<table>_<rule>`, `ix_<table>_<columns>`. The error translator and the naming lint depend on it.
- Give each relationship an explicit delete rule and index the foreign key. Tests already fail if an
  FK column is unindexed or a constraint has no bypass test (NFR-307): add both.
- A table for AI requests (user, purpose, token counts, cost) fits the existing roles. `ih_app` gets
  row privileges automatically through default privileges; `ih_readonly` needs an explicit column
  grant in the migration, as `0003` does. `pgvector` would be `CREATE EXTENSION` in a migration run
  by `ih_migrator` (check the host allows it).

## Adding a repository

Protocol in `app/repositories/base.py`, an in-memory version, a SQL version in
`app/repositories/sql/`, and the parametrised contract suite
(`tests/unit/test_repository_contract.py`) runs both. Services use it through the unit of work
(`app/services/transaction.py`): `read` for reads, `write` for anything that changes data.

## Configuration Task 4 needs to know

| Variable | Note |
| --- | --- |
| `STORAGE_BACKEND=sql`, `DATABASE_URL` | Application role, `?ssl=require` in production |
| `MIGRATION_DATABASE_URL` | Deploy step only; keep it out of the running API's environment |
| `SECRET_KEY`, `SEED_PASSWORD`, `CORS_ORIGINS` | As in Task 2 |

Deploy order: migrate as `ih_migrator`, then start the API. The API never migrates itself.

## Known gaps to plan around

- One worker only (the rate limiter is per process). Sustained throughput is about 40 requests a
  second per worker on the dev machine (ADR-330).
- Task 1 features with no endpoint: password reset, password and email change, avatar upload,
  self-service account deletion (`docs/compatibility-task1.md`).
- Types generated from `docs/openapi.json` differ from the dashboard's Zod types on three
  nullability fields (`Project.dueDate`, `User.avatarUrl`, `Activity.taskId`).
- Tokens live 15 minutes and cannot be revoked; there is no refresh token.
- Hard delete: an audit log needs a design (roadmap, pack section 12).
