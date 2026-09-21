# ADR-320: the read-only role has its own password variable and a column-level grant in a migration

**Status:** Accepted.

The pack defines `ih_readonly` (SELECT on every table except `users.password_hash`) but lists no variable for its password and does not say where the column grant lives. `READONLY_DB_PASSWORD` is read by `database/init/roles.sh`, which creates the role and deliberately gives it no default privileges. Revision `0003_reporting_grants` grants column by column and does nothing when the role does not exist, so a bare database still migrates. A test proves that `SELECT password_hash` and `SELECT *` on `users` are refused for this role (TC-336).
