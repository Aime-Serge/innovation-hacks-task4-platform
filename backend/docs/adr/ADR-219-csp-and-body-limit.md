# ADR-219: CSP for the docs pages, and how the body limit works

**Status:** Accepted.

1. **CSP.** API responses carry `Content-Security-Policy: default-src 'none'`, as the pack says. Swagger UI cannot load under that policy, so `/docs`, `/redoc` and `/openapi.json` get a policy that allows the UI's own scripts and styles. Those routes do not exist in production (`DOCS_ENABLED` defaults to off there), so the relaxed policy never reaches production.
2. **Body limit (1 MB).** A `Content-Length` over the limit is refused at once with 413. A chunked body has no length, so the guard also counts bytes as they arrive and answers 413 the moment the total passes the limit. FastAPI would otherwise convert the guard's exception into a 400, so the guard sends the 413 itself and drops whatever the framework tries to send afterwards. A test streams 1.2 MB in chunks (TC-262).
3. **415.** A body on POST, PATCH or PUT whose content type is not `application/json` is refused before parsing.
