# ADR-326: a hung database is cut off by a client deadline as well as server timeouts

**Status:** Accepted.

`statement_timeout` and `lock_timeout` are enforced by the server, so they do nothing when the server is unreachable. With the database paused the first version took 35 seconds to answer, because each stale pooled connection waited out the driver's own timeout. Now every statement runs under a client deadline equal to the pool timeout (5 s), the connection is invalidated when it passes, and `/readyz` gives up after 3 s without waiting for cleanup. An outage answers 503 within 5 s and the API recovers by itself within 30 s of the database returning (NFR-312, TC-360).
