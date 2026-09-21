# ADR-004 (Pack ADR-004, 005): server state and URL state

**Status:** Accepted

- TanStack Query owns loading, error, retry and cache for every read. Each dynamic region reads `isPending`, `isError` and `data` and renders one of the five states through `RegionState`.
- Search, filters and sort live in the query string. Every value is parsed with Zod or an allow-list; unknown values fall back to defaults (TH-02). Other parameters, such as `scenario`, survive an update.
- The optimistic status change (FR-19) is a mutation with `onMutate` and a rollback, so the UI never drifts from the service.
