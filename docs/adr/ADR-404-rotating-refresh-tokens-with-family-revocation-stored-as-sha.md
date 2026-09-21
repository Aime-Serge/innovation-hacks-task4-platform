# ADR-404: Rotating refresh tokens with family revocation, stored as SHA-256 hashes

**Status:** Accepted (from the Task 4 pack, section 7).

**Reason.** Real logout and theft detection

**Where it lives.** `backend/app/services/session_service.py`, migration 0005.
