# ADR-217: activity `limit`, user reads, and `completed` events

**Status:** Accepted.

1. **`GET /activity` and paging.** FR-221 says `limit`; FR-229 says every list uses `page` and `pageSize` and returns the common page shape. The endpoint returns the common shape and treats `limit` (1 to 50, default 10) as the page size of page 1. Task 1's dashboard sends `limit` and expects an array, so its adapter reads `items` (see `docs/compatibility-task1.md`).
2. **Who reads users.** UC-204 says user management is for the lead; the authorization matrix says any authenticated user may read users and only a lead may write. The matrix is the more specific document, and the dashboard needs names for assignees, so reads are open to any authenticated user. `tests/security/test_authorization_matrix.py` holds the matrix and fails if an operation is missing from it.
3. **A transition to `done`** records a `completed` activity, not `status_changed`, matching the activity types Task 1 already renders.
