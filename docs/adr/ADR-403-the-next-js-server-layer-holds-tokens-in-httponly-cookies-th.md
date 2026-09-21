# ADR-403: The Next.js server layer holds tokens in `HttpOnly` cookies; the API stays Bearer-only

**Status:** Accepted (from the Task 4 pack, section 7).

**Reason.** Tokens unreachable by page scripts; implements Task 1 TH-08 and Task 2 ADR-204

**Where it lives.** `frontend/src/lib/session`, ADR-425.
