# ADR-615: Follow the repository layout, not the pack's paths

**Status:** Accepted (from the readback, GAP-08).

**Reason.** The pack writes `backend/`, `database/`, `scripts/`; the repository has `backend/database/`, root `scripts/` and `backend/scripts/`, and `docs/` at the root and in `backend/docs/`. The OpenAPI file lives in `backend/docs/openapi.json`. The root `docs/` holds the pack documents.

**Where it lives.** `backend/docs/openapi.json`, `docs/`.
