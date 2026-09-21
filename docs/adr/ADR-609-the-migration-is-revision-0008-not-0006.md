# ADR-609: The migration is revision 0008, not 0006

**Status:** Accepted (from the readback, GAP-01).

**Reason.** The pack names `0006_minimal_profile`, but the repository already has 0006 (ai_requests) and 0007 (visibility index). The new revision is `0008_minimal_profile` with down revision `0007`. Migrations 0001 to 0007 and the Task 3 tables are untouched.

**Where it lives.** `backend/migrations/versions/0008_minimal_profile.py` (to be confirmed).
