# Baseline audit (Phase 0)

Audit of the frontend as it stood on `main` at commit `57a8675`, before the
rebuild on `task/1-frontend`. Each finding names the Pack item it breaks and
what the rebuild did about it. The rebuild's evidence is in the README's gate
table and the requirement table in `docs/traceability.md`.

## What the baseline already had

- Next.js 16 App Router, TypeScript, Tailwind v4 with a CSS-variable token file.
- Loading, empty and error states on the views it had, and a Retry button.
- Mock login, register, forgot and reset password, with a route guard.
- Icon plus text on every status badge; a skip link; an accessibility scan
  that ran against the deployed site.
- 8 test files (21 tests).

## Findings

| # | Finding | Pack item | Severity | Action |
| - | --- | --- | --- | --- |
| 1 | Four JavaScript files: `eslint.config.mjs`, `postcss.config.mjs`, `scripts/qa-checks.mjs`, `scripts/live-e2e-check.mjs` | NFR-11, TH-01 (TC-082) | Must | ESLint config and both scripts rewritten in TypeScript; `postcss.config.mjs` became the declarative `postcss.config.json`, so the allowlist is empty. `check:no-js` enforces this |
| 2 | `allowJs: true`; `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride` missing | Section 7 TypeScript rules (TC-081) | Must | `tsconfig.json` is strict with all four, `allowJs: false` |
| 3 | No Zod: types were hand-written and no response was validated | Section 7, TH-03 | Must | `src/schemas` is the source of every type; the mock adapter parses every response |
| 4 | Components imported mock data directly | Section 7 (ADR-003), NFR-24 | Must | Service interfaces in `src/services`; only `src/providers` imports an adapter; ESLint enforces it |
| 5 | No TanStack Query; a hand-rolled `useAsync` hook | ADR-004 | Must | TanStack Query behind `src/features/data/hooks.ts` |
| 6 | No Radix; hand-built modal and menus | ADR-006, FR-06, FR-08 | Should | Radix Dialog, DropdownMenu, Tooltip, Toast, Avatar |
| 7 | No Prettier, no coverage, no Lighthouse, no CI, no secret scan, no dependency audit script | NFR-13..15, NFR-17, section 12 | Must | All added; `npm run gate` runs them in the Pack's order; `.github/workflows/ci.yml` |
| 8 | No security headers or CSP | NFR-16, TH-01, TH-06 | Must | Static headers in `next.config.ts`, nonce CSP in `src/proxy.ts` (ADR-011) |
| 9 | Dependencies used ranges (`^`) | TH-05 | Must | All pinned to exact versions; Dependabot config added |
| 10 | Oversized components: `SettingsView` 330 lines, `mock-data.ts` 278, `mock-auth.ts` 275, `ProjectDetailView` 207 | NFR-12 (TC-083) | Must | No component over 200 lines (a test checks this); Settings removed (ADR-013); mock data split into fixtures, behaviour, accounts |
| 11 | Routes `/projects`, `/tasks`, `/profile` missing; the dashboard mixed everything | FR-01, FR-05, FR-09, FR-14, UC-02, UC-03 | Must | Four routes plus project detail |
| 12 | Status model `in-progress`, `blocked`; no `in_review`; no `urgent` | BR-01, BR-02 | Must | Migrated (ADR-012) |
| 13 | Filters lived in component state | FR-17 | Should | URL-synced, parsed defensively (TH-02) |
| 14 | The search box had no debounce | FR-15 | Must | 250 ms debounce and an announced result count |
| 15 | No toast component, so a failed status change had nowhere to report | FR-19 | Should | Optimistic update with rollback and an error toast |
| 16 | Only Chromium installed; no Firefox or WebKit runs | NFR-18 | Must | Firefox runs locally; WebKit runs in CI only (ADR-016) |
| 17 | Dark theme only | FR-24 | Should | Light, dark and system with no flash |
| 18 | A dev-only "simulate error" flag and one fixed 500 ms delay; no scenarios | Section 8, FR-22 | Must | Nine scenarios selectable by `?scenario=` |
| 19 | No i18n dictionary; strings in JSX | NFR-21 | Should | `src/i18n/en.ts`; `react/jsx-no-literals` fails the lint step |
| 20 | No error reporting interface | NFR-20 | Should | `reportError` with a swappable sink |

## Baseline bug found and fixed on the way

A stale `mock_session` cookie with no matching account made the route guard and
the client redirect bounce between `/login` and `/`. `getSession` now drops a
cookie that names no account.

## Not addressed by the rebuild

Nothing on the Pack's Must list was left out. Deviations and limits are in
`docs/adr/` (ADR-009 to ADR-016) and in the README's "Known limitations".
