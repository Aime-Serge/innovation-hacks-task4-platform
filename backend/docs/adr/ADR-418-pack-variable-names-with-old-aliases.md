# ADR-418: Task 4 environment variable names win; the Task 3 names stay as aliases for one release

**Status:** Accepted.

The Task 4 pack names `JWT_SECRET`, `CORS_ALLOWED_ORIGINS`, `ACCESS_TOKEN_TTL_S` and `REFRESH_TOKEN_TTL_S`. Task 3 used `SECRET_KEY`, `CORS_ORIGINS` and `ACCESS_TOKEN_TTL_SECONDS`. Settings now reads the pack name first and the old name second, so an existing `.env` keeps working. An error for a missing secret now names `JWT_SECRET`, which changed one Task 3 test (TC-322); this is a deviation outside S1 to S8 and is logged in `docs/supersession-log.md`. The aliases are removed one release later.
