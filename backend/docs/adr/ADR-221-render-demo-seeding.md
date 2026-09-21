# ADR-221: the Render demo runs with seeded data and is not `APP_ENV=production`

**Status:** Accepted for the demo only. **Open** for a real production deployment.

The pack makes seeding refuse to run when `APP_ENV=production`, and it says there are no default credentials. Data lives in memory, so an empty production instance has no lead and no way to create one: registration always creates a developer (BR-209).

For the Render demo, `render.yaml` sets `APP_ENV=development`, `SEED_PROFILE=default`, a generated `SECRET_KEY`, and a `SEED_PASSWORD` that the owner types into the dashboard (`sync: false`, never committed). Consequences, stated plainly: HSTS is not sent by the app (Render's edge terminates TLS), Swagger UI is on, and the data resets on every restart.

**Before real production use:** switch to `APP_ENV=production`, remove `SEED_PROFILE`, and provision the first lead through the database in Task 3.
