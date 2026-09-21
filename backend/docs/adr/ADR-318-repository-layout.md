# ADR-318: a standalone repository with `database/` beside `app/`

**Status:** Accepted. Extends ADR-212.

The pack assumes a monorepo (`backend/`, `database/`). This is the Task 3 repository on its own, as Tasks 1 and 2 were. `app/`, `migrations/`, `tests/` and `alembic.ini` are at the root, and `database/` (compose file, role script, backup scripts, generated ERD and data dictionary) sits next to them, so moving into a monorepo is a `git mv` and a working-directory change in CI.
