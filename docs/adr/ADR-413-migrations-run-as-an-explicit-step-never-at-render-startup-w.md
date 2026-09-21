# ADR-413: Migrations run as an explicit step, never at Render startup, with expand-then-contract changes

**Status:** Accepted (from the Task 4 pack, section 7).

**Reason.** Keeps the migration role out of the running service

**Where it lives.** `scripts/db-migrate-prod.sh`, `docker-compose.yml` (the migrate service).
