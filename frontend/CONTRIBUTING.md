# Contributing

## Set up

```bash
npm ci
npm run dev
```

Node 22 or newer.

## Workflow

1. Branch from `main`: `task/<n>-<topic>` or `feat/<topic>`.
2. Make small, logical commits: `type(scope): description`. Types: `feat`, `fix`, `perf`, `test`, `docs`, `build`, `refactor`. Scopes: `frontend`, `api`, `db`, `ai`, `auth`, `deploy`, `env`, `docs`.
3. Every requirement change needs a test whose title starts with its `TC-###`, and an update to `docs/traceability.md`.
4. Run `npm run gate` before opening a pull request. List the requirement IDs you touched in the description and attach mobile and desktop screenshots for UI changes.
5. A deviation from the Standards Pack needs an ADR in `docs/adr/`. Never loosen a lint rule, threshold or test to make the gate pass.

## Code rules

- 100% TypeScript, no `any`, no `@ts-ignore`; types come from the Zod schemas.
- Components stay under 200 lines and import only downward: `app` to `features` to `ui`; only `src/providers` imports an adapter.
- No raw colour, spacing or font values outside `src/styles/tokens.css`.
- User-facing strings live in `src/i18n/en.ts`.
- Every dynamic region handles loading, empty, no-results and error with Retry.
