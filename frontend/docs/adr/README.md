# Architecture decision records

ADR-001 to ADR-008 are the decisions fixed by the Engineering Standards Pack
(section 7). ADR-009 onward record every place this build chose an
interpretation, or deviates from the Pack, so a reviewer can find the reason.

| ID | Decision | Status |
| --- | --- | --- |
| [ADR-001](ADR-001-stack.md) | Next.js App Router, strict TypeScript, service interface with mock adapter (Pack ADR-001 to 003) | Accepted |
| [ADR-004](ADR-004-server-state-and-url.md) | TanStack Query for server state; filter state in the URL (Pack ADR-004, 005) | Accepted |
| [ADR-006](ADR-006-primitives-and-tokens.md) | Radix primitives; design tokens as CSS variables mapped in Tailwind (Pack ADR-006, 007) | Accepted |
| [ADR-008](ADR-008-openapi-types.md) | Types generated from the FastAPI OpenAPI schema from Task 2 onward (Pack ADR-008) | Accepted, not yet applicable |
| [ADR-009](ADR-009-scenario-switcher.md) | Scenario switcher stays available in production builds | Accepted |
| [ADR-010](ADR-010-mock-auth.md) | Keep the mock login flow although real authentication is out of scope | Accepted, deviation from TH-08 |
| [ADR-011](ADR-011-csp-and-theme-script.md) | Nonce CSP with dynamic rendering, and a nonce'd inline theme script | Accepted |
| [ADR-012](ADR-012-status-model.md) | Task status and priority migrate to the Pack model | Accepted |
| [ADR-013](ADR-013-settings-removed.md) | The baseline Settings page is folded into Profile | Accepted, scope reduction |
| [ADR-014](ADR-014-repository-layout.md) | The project lives at the repository root, not in `frontend/` | Accepted, deviation |
| [ADR-015](ADR-015-lint-tuning.md) | One typescript-eslint rule is tuned | Accepted |
| [ADR-016](ADR-016-webkit-and-lighthouse.md) | WebKit runs in CI only; Lighthouse runs against the mock session | Accepted, limitation |
| [ADR-017](ADR-017-first-load-javascript.md) | The 170 KB first-load JavaScript budget is not met | Open, not met |
