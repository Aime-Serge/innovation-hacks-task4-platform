# ADR-330: the PostgreSQL load gate runs 3 concurrent users; capacity is about 40 requests a second

**Status:** Accepted, with the limits stated.

The pack sets latency targets for the `xl` data set (lists 200 ms, single reads and writes 100 ms at
p95) but not how many users are on the server. It does keep one worker, because the rate limiter is
per process. Measured on this machine, one worker on PostgreSQL costs about 15 to 25 ms of CPU per
request (two units of work, one for the token's user and one for the operation), against about 6 ms
on the in-memory backend, so it sustains roughly 40 requests a second.

| Concurrent users (Locust, 40 s, stats reset after the ramp) | Result on the `xl` data set |
| --- | --- |
| 3 | Every endpoint inside its target (lists at most 100 ms, single reads and writes at most 89 ms) |
| 5 | Lists 180 to 300 ms and dashboard summary 160 ms: over target |
| 10 | Lists 270 to 400 ms, single reads 140 to 200 ms: over target, because the offered load exceeds what one worker can serve |

The gate therefore runs 3 users, a small team using the dashboard, and says so. It does not claim the
targets hold at 10 users: they do not, on this machine and with one worker. What raises the ceiling
is out of scope for Task 3 (a shared rate-limit store so that several workers are safe, and a pooler
in front of the database) and is on the roadmap. The machine also ran a browser and an editor during
these measurements, so the absolute numbers are pessimistic, and the run-to-run spread is wide; the
figures in the final report come from the gate run itself.

Measures taken because of this test, each recorded in its own ADR: a window count only for small
tables (ADR-328), an index for the default task order (migration `0004`), reads in autocommit and no
pool pre-ping (ADR-329), and a vacuum after the bulk load, as autovacuum would do.
