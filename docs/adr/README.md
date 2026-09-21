# Architecture decisions for Task 4

Decisions 401 to 417 come from the pack. 418 onward record where the pack and the existing code disagreed, or where the owner chose differently. Earlier decisions are in `backend/docs/adr/` (Tasks 2 and 3) and `frontend/docs/` (Task 1).

| ADR | Decision |
|---|---|
| [ADR-401](ADR-401-vercel-for-the-frontend-render-for-the-api-and-database-the.md) | Vercel for the frontend, Render for the API and database; the browser talks only to Vercel |
| [ADR-402](ADR-402-task-generation-is-the-must-ai-feature-prioritisation-and-su.md) | Task generation is the Must AI feature; prioritisation and summary are Should |
| [ADR-403](ADR-403-the-next-js-server-layer-holds-tokens-in-httponly-cookies-th.md) | The Next.js server layer holds tokens in `HttpOnly` cookies; the API stays Bearer-only |
| [ADR-404](ADR-404-rotating-refresh-tokens-with-family-revocation-stored-as-sha.md) | Rotating refresh tokens with family revocation, stored as SHA-256 hashes |
| [ADR-405](ADR-405-visibility-scoping-with-404-for-unreadable-objects.md) | Visibility scoping with 404 for unreadable objects |
| [ADR-406](ADR-406-email-shown-only-to-self-and-leads.md) | Email shown only to self and leads |
| [ADR-407](ADR-407-llmclient-abstraction-with-anthropic-default-and-a-determini.md) | `LLMClient` abstraction with Anthropic default and a deterministic fake |
| [ADR-408](ADR-408-structured-output-through-a-schema-validated-with-one-repair.md) | Structured output through a schema, validated, with one repair attempt |
| [ADR-409](ADR-409-prompts-contain-aliases-and-no-personal-data.md) | Prompts contain aliases and no personal data |
| [ADR-410](ADR-410-ai-suggests-people-confirm-the-model-has-no-tools.md) | AI suggests; people confirm; the model has no tools |
| [ADR-411](ADR-411-quotas-and-usage-stored-in-postgresql-metadata-only.md) | Quotas and usage stored in PostgreSQL, metadata only |
| [ADR-412](ADR-412-the-model-returns-relative-days-never-absolute-dates.md) | The model returns relative days, never absolute dates |
| [ADR-413](ADR-413-migrations-run-as-an-explicit-step-never-at-render-startup-w.md) | Migrations run as an explicit step, never at Render startup, with expand-then-contract changes |
| [ADR-414](ADR-414-database-url-is-composed-by-hand-with-the-async-driver-schem.md) | `DATABASE_URL` is composed by hand with the async driver scheme and TLS |
| [ADR-415](ADR-415-one-api-instance-in-process-rate-limiter-retained.md) | One API instance; in-process rate limiter retained |
| [ADR-416](ADR-416-prompts-are-versioned-files-in-the-repository.md) | Prompts are versioned files in the repository |
| [ADR-417](ADR-417-live-ai-evaluation-is-manual-and-recorded-the-gate-uses-the.md) | Live AI evaluation is manual and recorded; the gate uses the fake provider |
| [ADR-420](../../backend/docs/adr/ADR-420-refresh-cookie-is-strict.md) | The refresh cookie is SameSite=Strict, the access cookie Lax |
| [ADR-421](../../backend/docs/adr/ADR-421-monorepo-layout.md) | Task 3 becomes backend/ and Task 1 becomes frontend/ in one repository |
| [ADR-422](../../backend/docs/adr/ADR-422-task1-pack-text-is-lossy.md) | The extracted Task 1 pack text is incomplete; the PDF is the reference |
| [ADR-423](../../backend/docs/adr/ADR-423-visibility-is-a-read-scope-built-once.md) | visibility is a `ReadScope` built by one function and applied by every query |
| [ADR-424](../../backend/docs/adr/ADR-424-gemini-is-the-live-provider.md) | Gemini is the live AI provider; Anthropic is not implemented |
| [ADR-425](ADR-425-refresh-runs-through-the-server-layer-and-a-session-marker.md) | silent refresh is triggered by the page through the server layer, and a marker cookie feeds the route guard |
