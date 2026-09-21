# ADR-414: `DATABASE_URL` is composed by hand with the async driver scheme and TLS

**Status:** Accepted (from the Task 4 pack, section 7).

**Reason.** The platform's ready-made string uses a different scheme

**Where it lives.** `render.yaml`, `scripts/db-migrate-prod.sh`, `backend/app/core/config.py`.
