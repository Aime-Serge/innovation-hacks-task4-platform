# ADR-216: a small in-process rate limiter instead of slowapi

**Status:** Accepted, with a known limit.

The pack limits login to 5 attempts a minute per client **and** email. slowapi computes its key before the request body is parsed, so it cannot key on the email in the JSON body without re-reading the stream. The limiter in `app/core/ratelimit.py` is a sliding window over a `deque` per key, driven by the injected clock, so tests control time.

- Login is keyed `login:<ip>:<email>`, so one person cannot lock another out from a different address.
- Registration is keyed `register:<ip>` only. Keying it by email as well would let an attacker vary the address to dodge the limit; a test (TC-305) covers this.
- A blocked request gets 429 `RATE_LIMITED` and a `Retry-After` header.

**Limit.** State is per process. With more than one worker each has its own counters, so the effective limit is multiplied. The service runs one worker (in-memory data forces that anyway). A multi-worker or multi-instance deployment needs a shared store, which arrives with the database in Task 3.
