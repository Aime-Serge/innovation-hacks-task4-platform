# ADR-317: the only changes to Task 2 tests are set-up, never assertions

**Status:** Accepted. Every changed test is listed here so a reviewer can check the claim.

| Change | Why |
| --- | --- |
| `--backend memory\|sql` option and a `build_env` that points the app at PostgreSQL | The pack asks for the Task 2 suite to run on both backends without copying it |
| `test_repository_contract.py` runs on `memory` and `sql`; rows that name an owner, a project or an assignee first store that row; a done task carries `completed_at` | PostgreSQL enforces the foreign keys and BR-303, which the in-memory store never did. No assertion changed |
| `test_seed_and_rules.py` reads tasks through `container.uow()` | `container.tasks_repo` no longer exists, since every operation runs in a unit of work |
| `make_settings` supplies a placeholder SQL setting for a production app | Production now refuses the memory backend (FR-318); the test that checks docs are off in production only builds the app |

The full suite, 154 tests plus the new ones, passes on both backends.
