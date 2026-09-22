# ADR-610: Password change ends other sessions through an optional refresh token

**Status:** Accepted (from the readback, GAP-02).

**Reason.** The pack says other sessions end, but the access token carries no session id. `POST /me/password` accepts an optional `refreshToken` (the server layer sends the cookie's value); every token family except that token's family is revoked, and if it is absent all are revoked.

**Where it lives.** `backend/app/api/v1/me.py`, `backend/app/services/session_service.py` (to be confirmed).
