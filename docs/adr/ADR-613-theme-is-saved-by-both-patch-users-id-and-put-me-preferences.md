# ADR-613: Theme is saved by both `PATCH /users/{id}` and `PUT /me/preferences`

**Status:** Accepted (from the readback, GAP-05).

**Reason.** `users.theme` stays where Task 3 put it. `/me/preferences` is a thin wrapper over the same column, so nothing already using the old endpoint breaks.

**Where it lives.** `backend/app/api/v1/me.py` (to be confirmed).
