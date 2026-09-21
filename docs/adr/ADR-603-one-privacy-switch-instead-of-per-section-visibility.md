# ADR-603: One privacy switch instead of per-section visibility

**Status:** Accepted (from the Minimal Profile pack, section 9).

**Reason.** Small, testable and easy to explain. Profiles are visible to signed-in members only; the switch applies at once (`PUT /me/privacy`).

**Where it lives.** `profiles` privacy column, `backend/app/api/v1/me.py` (to be confirmed).
