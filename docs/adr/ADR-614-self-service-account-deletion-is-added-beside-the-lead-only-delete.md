# ADR-614: Self-service account deletion is added beside the lead-only delete

**Status:** Accepted (from the readback, GAP-07).

**Reason.** `DELETE /users/{id}` stays lead-only. `POST /me/delete` requires the person's password and is blocked with `USER_OWNS_PROJECTS` when they own projects.

**Where it lives.** `backend/app/api/v1/me.py` (to be confirmed).
