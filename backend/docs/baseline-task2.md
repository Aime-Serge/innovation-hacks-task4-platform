# Task 2 baseline (tag `task-2-baseline`)

`make gate` on the merged Task 2 backend, before any Task 3 change. `docs/openapi.baseline.json` is
a copy of its `docs/openapi.json`, and the diff check in Phase 5 compares against it.

| Target | Result |
| --- | --- |
| `make lint` | ruff clean, 81 files formatted |
| `make typecheck` | `mypy --strict` on `app scripts tests`, 78 files, 0 errors |
| `make layers` | 3 contracts kept |
| `make test` | 154 passed, coverage 97.59% (threshold 90%), 24 of 24 operations have a success and a failure test |
| `make spec-check`, `make spec-diff` | pass, no breaking change |
| `make contract` | Schemathesis, 24 passed |
| `make security` | bandit clean, pip-audit no known vulnerabilities |
| `make postman` | Newman: 18 assertions, 0 failed |
| `make load` | **flaky on this machine, see below** |

**The load step.** The same code gave a worst p95 of 89 ms in one run and 110 to 130 ms in others.
Thresholds are 150 ms for lists and 100 ms for single reads. The runs that failed did so on
`GET /dashboard/summary` (110 to 130 ms) and, once, `GET /tasks/{id}` and `POST /tasks` (120 ms). The
machine was also running a browser, an editor and an unrelated backend, with a load average near 2
on 8 cores. This is measurement noise, not a defect in the baseline, and it is not fixed by
loosening the threshold. The Task 3 gate reports its own load figures from the run it makes.
