# ADR-611: `GET /me` is added and `GET /auth/me` is kept

**Status:** Accepted (from the readback, GAP-03).

**Reason.** The pack calls `GET /me`; the API has `GET /auth/me`. The new endpoint is additive and the old one is unchanged, so the previous frontend keeps working.

**Where it lives.** `backend/app/api/v1/me.py` (to be confirmed).
