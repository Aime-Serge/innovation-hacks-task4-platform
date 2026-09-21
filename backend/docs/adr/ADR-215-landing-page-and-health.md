# ADR-215: no landing page; health is `/healthz` and `/readyz`

**Status:** Accepted.

The old service answered `GET /` with a landing message and `GET /health`. The pack says only documented routes exist and an unknown route is a 404, so `/` is removed and Swagger UI at `/docs` is the entry point in development. Health moves to `/healthz` (the process is up) and `/readyz` (repositories answer, else 503 `SERVICE_UNAVAILABLE`). Neither needs a token, neither is versioned, and `render.yaml` and the Dockerfile healthcheck point at `/healthz`.
