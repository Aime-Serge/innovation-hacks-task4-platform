# Blockers and open items

| # | Item | State |
| --- | --- | --- |
| 1 | `make load` (the in-memory Task 2 profile: 20 users, lists 150 ms, single reads 100 ms) fails intermittently on this machine | **Open.** The untouched Task 2 baseline fails it the same way when the machine is busy (measured back to back: baseline `/projects` 300 to 400 ms, this branch 330 to 380 ms). In-process latency is at parity or better (projects 11.6 vs 12.2 ms, dashboard summary 18.5 vs 8.3 ms). It passed on an earlier quiet run of the baseline (worst p95 89 ms). Not fixed by loosening a threshold. Worth running in CI |
| 2 | The PostgreSQL load figures hold at 3 concurrent users, not 10 (ADR-330) | **Open, by design.** One worker sustains about 40 requests a second here. More users need a shared rate-limit store and more workers, which the pack puts out of scope |
| 3 | The Task 1 pack extract cannot be re-counted (ADR-321) | Recorded |
| 4 | `make gate` was not run to completion in a single invocation | The steps were run as one `make gate` (up to and including `make load`, which stopped it) and then `make postman load db-gate` and the remaining targets separately. Every target other than `make load` passed; see the report |
