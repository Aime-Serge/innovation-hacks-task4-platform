# ADR-605: No email verification in this release

**Status:** Accepted (from the Minimal Profile pack, section 9).

**Reason.** Avoids a new external service and secret; recorded as the first item to add. Note (GAP-06): the existing `forgot-password` and `reset-password` pages under `frontend/src/app/(auth)` are left untouched and are not extended.

**Where it lives.** README known limitations.
