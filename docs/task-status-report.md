# Task 4 status report

Statuses: **Done** = the command ran and passed; **Partial** = built, with the gap stated; **Pending live verification** = needs your deployment or key. Nothing is marked Done without evidence.

## Functional requirements
| ID | Status | Evidence |
|---|---|---|
| FR-401 | Partial | TC-401 journey; duplicate email 409 (adapter test). Not done: the page does not yet say registration is closed (403 shows the generic error) |
| FR-402 | Done | TC-402 journey redirect; generic message (Task 1); note the return path parameter is Task 1's `next`, not `returnTo` |
| FR-403 | Done | TC-403 backend + adapter + journey log out |
| FR-404 | Done | TC-404 proxy tests + journey redirects |
| FR-405 | Done | TC-405 client tests (one refresh, one retry) + skeleton refresh |
| FR-406 | Done | TC-406 backend + SQL |
| FR-407 | Done | TC-407 backend + SQL race |
| FR-408 | Done | TC-410/411 isolation matrix (memory + PostgreSQL) |
| FR-409 | Done | TC-412 |
| FR-410 | Partial | Task 1 dashboard on the real API opens in the journey and passes axe; no dedicated data assertion (TC-420 not written) |
| FR-411 | Done | journey creates a project |
| FR-412 | Partial | Edit works; not restricted to owner or lead in the UI (the API enforces it) |
| FR-413 | Done | TC-421 component tests (confirmation, 409 message with link) |
| FR-414 | Partial | Fields, progress, task list, AI panel, not-found page; the project activity list is missing |
| FR-415 | Partial | Create task works (Task 1 form, AI dialog); the PROJECT_CLOSED explanation is not yet shown |
| FR-416 | Done | assignee chosen by name from the directory (Task 1 form); visibility on assignment: TC-410 |
| FR-417 | Partial | Status change works and 409s roll back; the control offers all four statuses, not only the allowed next ones |
| FR-418 | Done | Task 1 form and card (native date input) |
| FR-419 | Done | Task 1 URL filters (mock browser tests); HTTP adapter maps every filter (unit) |
| FR-420 | Done | TC-422 component tests (confirm, optimistic removal, restore on failure) |
| FR-421 | Done | TC-430 API + TC-421 UI gating + fault test |
| FR-422 | Done | TC-431 |
| FR-423 | Done | TC-444 component tests + journey + axe |
| FR-424 | Done | TC-434 |
| FR-425 | Done | TC-434 UI tests |
| FR-426 | Done | TC-435 |
| FR-427 | Done | TC-445 + settings tests; Gemini is the live provider (ADR-424) |
| FR-428 | Done | TC-436/437 |
| FR-429 | Done | TC-439 incl. PostgreSQL burst test |
| FR-430 | Done | TC-440 |
| FR-431 | Done | TC-430 + fault test ai-off |
| FR-432 | Done | TC-441 + journey |
| FR-433 | Done | TC-442 |
| FR-434 | Done | TC-446 |
| FR-435 | Done | TC-450 (29 tests) + skeleton attacks refused |
| FR-436 | Done | TC-452 drift check, TC-453 adapter tests |
| FR-437 | Partial | render.yaml validated (TC-454); not deployed |
| FR-438 | Partial | Vercel settings and headers validated (TC-454/455); not deployed |
| FR-439 | Done | scripts + TC-456 (previous release 95 of 95 on the new schema); production run is yours |
| FR-440 | Partial | make smoke passes locally; live run pending |
| FR-441 | Pending live verification | monitor is your step (runbook) |
| FR-442 | Pending live verification | rollback rehearsal is your step (runbook) |
| FR-443 | Done | TC-466 docs-check |
| FR-444 | Done | TC-469 demo-data run through the site |

## Non-functional requirements
| ID | Status | Evidence |
|---|---|---|
| NFR-401 | Pending live verification | needs your Gemini key: make ai-eval |
| NFR-402 | Pending live verification | smoke prints timings; warm live run pending |
| NFR-403 | Partial | retry and banner tested (TC-459 unit); live cold start pending |
| NFR-404 | Pending live verification | Lighthouse on the deployed URL |
| NFR-405 | Done | fault-injection browser tests 5 of 5 |
| NFR-406 | Pending live verification | redeploy check |
| NFR-407 | Pending live verification | rehearsal |
| NFR-408 | Done | TC-456 |
| NFR-409 | Done | journey checks: no token in storage or cookie string, every cookie HttpOnly |
| NFR-410 | Pending live verification | live HTTPS and HSTS |
| NFR-411 | Done | bundle scan clean; gitleaks in the gate |
| NFR-412 | Done | isolation matrix |
| NFR-413 | Done | TC-442 |
| NFR-414 | Done | 20 fixtures x 2 scenarios + browser test |
| NFR-415 | Partial | npm audit passes; pip-audit runs in make security |
| NFR-416 | Partial | connect-src, frame-ancestors, HSTS and others validated in files; live header check pending |
| NFR-417 | Pending live verification | make ai-eval |
| NFR-418 | Pending live verification | make ai-eval and your rating |
| NFR-419 | Done | TC-439/440 |
| NFR-420 | Partial | axe: 0 violations on real screens; Task 1 bundle budget still exceeded (B-401) |
| NFR-421 | Partial | journey passes at 3 viewports locally; live pending |
| NFR-422 | Partial | X-Request-ID passes site to API (tests); log correlation on the platforms pending |
| NFR-423 | Partial | Task 2/3 backend gate green; Task 1 gate red only on TC-090 |
| NFR-424 | Done | spec diff vs Task 3, types drift check |
| NFR-425 | Pending live verification | documented dry run |
