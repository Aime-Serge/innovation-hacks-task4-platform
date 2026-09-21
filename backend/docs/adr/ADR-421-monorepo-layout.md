# ADR-421: Task 3 becomes backend/ and Task 1 becomes frontend/ in one repository

**Status:** Accepted.

The pack wants one repository with `frontend/`, `backend/`, `database/`, `docs/`, `render.yaml` and `docker-compose.yml`. The Task 3 code is imported whole as `backend/` (with its `database/` folder and `docs/`) so its gate keeps running unchanged; root files, the standards packs and the Task 4 documents live in the root `docs/`. Moving `database/` to the root is left until after the gate is green, to avoid changing paths under tests. Nothing from the earlier Task 4 build is reused.
