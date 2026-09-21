# ADR-415: One API instance; in-process rate limiter retained

**Status:** Accepted (from the Task 4 pack, section 7).

**Reason.** Multiple instances need a shared limiter (roadmap)

**Where it lives.** `backend/Dockerfile` (`--workers 1`), `render.yaml`.
