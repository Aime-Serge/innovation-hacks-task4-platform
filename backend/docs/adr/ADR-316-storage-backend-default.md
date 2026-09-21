# ADR-316: `STORAGE_BACKEND` defaults to `memory` outside production

**Status:** Accepted.

The pack lists `STORAGE_BACKEND` as required. The Task 2 tests, a first local run and the earlier demo have no database, so requiring it everywhere would break every one of them. The default is `memory` for development and test. In production the setting must be `sql`: `memory` is refused, so an unset value stops startup and the message names the variable (FR-318). The `.env.example` template sets `sql`.
