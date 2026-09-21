# ADR-411: Quotas and usage stored in PostgreSQL, metadata only

**Status:** Accepted (from the Task 4 pack, section 7).

**Reason.** Limits survive restarts and no content is retained

**Where it lives.** `backend/app/ai/service.py`, migration 0006.
