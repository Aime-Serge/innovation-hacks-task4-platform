# Requirement traceability

Every row names the test IDs that prove the requirement. A test's title starts
with its ID, so `grep -rn "TC-051" tests` finds the proof. Status is
**Done**, **Partial** or **Not done**, and only reflects commands that were run
(figures are in the README's gate table).

IDs TC-001 to TC-093 come from the Pack's section 9. Section 9 does not name
tests for authentication, the theme, headers, the scenario switcher, i18n or the
error reporter, so this build adds **TC-004, 005, 007, 008, 009, 014, 016, 019,
022, 023, 024, 074 and 100** for them. TC-100 is the adapter contract (the Pack's
TC-081, "strict types", is enforced by `npm run typecheck` and has no test file).
TC-093 (dependency audit) is `npm run audit`.

## Functional requirements

| ID | Requirement | Status | Tests |
| --- | --- | --- | --- |
| FR-01 | Dashboard is the landing route | Done | TC-001 (e2e, unit) |
| FR-02 | Four KPIs | Done | TC-002 |
| FR-03 | Deadlines, next 7 days | Done | TC-003 |
| FR-04 | Recent activity, latest 10 | Done | TC-003 |
| FR-05 | Navigation with `aria-current` | Done | TC-010 |
| FR-06 | Sidebar at 1024 px, drawer below | Done | TC-011 |
| FR-07 | Skip link | Done | TC-012 |
| FR-08 | Profile menu with avatar, name, theme toggle | Done | TC-008, TC-009 |
| FR-09 | Profile page with stats | Done | TC-020 |
| FR-10 | Profile form with inline validation | Done | TC-021 |
| FR-11 | Project cards, truncation with a title tooltip | Done | TC-030 |
| FR-12 | Task cards, overdue marked and announced | Done | TC-030, TC-031 |
| FR-13 | Progress bar and ring with ARIA | Done | TC-040, TC-041 |
| FR-14 | Project detail and not-found state | Done | TC-014, TC-040 |
| FR-15 | Search, debounced 250 ms, count announced | Done | TC-050 |
| FR-16 | Filters, sort, clear all | Done | TC-051, TC-052 |
| FR-17 | State in the URL | Done | TC-053 |
| FR-18 | No-results differs from no-data | Done | TC-054 |
| FR-19 | Optimistic status change with rollback and toast | Done | TC-019 |
| FR-20 | Loading skeletons, no layout shift | Done | TC-070 |
| FR-21 | Empty state on every list and feed | Done | TC-071 |
| FR-22 | Error state with Retry on every dynamic view | Done | TC-072, TC-073 |
| FR-23 | Responsive at 360, 768, 1280 px and wider | Done | TC-060 |
| FR-24 | Light, dark, system, no flash | Done | TC-009 |

## Non-functional requirements

| ID | Requirement | Status | Tests |
| --- | --- | --- | --- |
| NFR-01 | LCP 2.5 s or less (mobile) | Done (0.76 to 1.43 s) | TC-090 (`npm run lighthouse`) |
| NFR-02 | CLS under 0.1 | Done (0.002 to 0.005) | TC-090 (`npm run lighthouse`) |
| NFR-03 | INP 200 ms or less | Done on a quiet machine (worst interaction 128 to 144 ms at 4x CPU throttle in four runs); one run under heavy load measured 264 ms | TC-090 (`tests/e2e/inp.spec.ts`) |
| NFR-04 | 170 KB or less of first-load JavaScript per route | **Not done** (186 to 188 KB against 170 KB) | TC-090 (`tests/e2e/bundle.spec.ts`), ADR-017 |
| NFR-05 | WCAG 2.2 AA, zero axe violations | Done (0 violations, 94 checks) | TC-091 |
| NFR-06 | Keyboard operation, visible focus | Done (automated part); manual checklist not run | TC-010, TC-011, TC-012 |
| NFR-07 | Contrast 4.5:1 and 3:1, both themes | Done | TC-007 |
| NFR-08 | Reduced motion | Done | TC-008 |
| NFR-09 | 360 to 2560 px | Done | TC-060 |
| NFR-10 | Touch targets 44 px | Done | TC-061 |
| NFR-11 | Strict types, no `any`, no `.js` | Done | `npm run typecheck`, TC-080, TC-082 |
| NFR-12 | Components under 200 lines, layering | Done | TC-080, TC-083 |
| NFR-13 | Prettier and ESLint clean | Done | `npm run lint` |
| NFR-14 | 80% coverage | Done | `npm run test` |
| NFR-15 | No secrets | Done | TC-092 |
| NFR-16 | CSP and security headers | Done, with one recorded relaxation | TC-016, ADR-011 |
| NFR-17 | No high or critical vulnerabilities | Done | TC-093 (`npm run audit`) |
| NFR-18 | Latest Chrome, Edge, Firefox, Safari | Partial: Chromium and Firefox run locally; WebKit and Edge only in CI or not at all | all e2e; ADR-016 |
| NFR-19 | A failed request stays inside its region | Done | TC-072, TC-073 |
| NFR-20 | One error-reporting function | Done | TC-024 |
| NFR-21 | Strings in one dictionary | Done | TC-023, `react/jsx-no-literals` |
| NFR-22 | Reproducible build | Done | `.github/workflows/ci.yml` (not yet run on GitHub) |
| NFR-23 | README follows the template | Done | Review |
| NFR-24 | Backend swap changes only the adapter | Done | TC-100 |

## Gate items outside the FR and NFR tables

| Item | Status | Evidence |
| --- | --- | --- |
| Lighthouse scores of 90 or more | **Not done**: performance 78 to 86; accessibility, best practices and SEO 100 | ADR-017 |
| Tag `task-1-submission` | **Not created** (the gate is red) | |
| Demo video, LinkedIn post | Not done: need a person | `DEMO_SCRIPT.md`, `docs/linkedin-post.md` |
