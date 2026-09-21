# ADR-225: a documented welcome page at `/`

**Status:** Accepted. Amends [ADR-215](ADR-215-landing-page-and-health.md).

ADR-215 removed the old landing page because the pack says only documented routes exist and an unknown route is a 404. In practice a reviewer who opens the bare URL saw a JSON `NOT_FOUND`, which looks like a broken service. The answer is not to bring back an undocumented route but to make `/` a documented one.

- `GET /` is in `docs/openapi.json` (summary, description, `text/html` response), public like the health checks, and covered by tests (TC-323). It is the only HTML route; every other unknown path is still a 404 in the envelope.
- The page is static: no script, no cookies, no data. It says what the service is, links to `/docs` and `/openapi.json` only when they are enabled, shows a three-call example, lists the resource groups, and states the in-memory and free-tier limits.
- It carries its own `Content-Security-Policy`: `default-src 'none'` plus a `style-src` hash of its single inline stylesheet, so the strict API policy is relaxed by exactly one hash and nothing else. The security-headers middleware leaves a route's own policy in place instead of adding a second one.
- Its HTML and CSS live in `app/web/`, not in Python strings.
