# ADR-425: silent refresh is triggered by the page through the server layer, and a marker cookie feeds the route guard

**Status:** Accepted.

**The conflict.** Section 6 puts the refresh cookie on `Path=/api/bff/auth`, so the browser sends it only to those routes. FR-405 also says a 401 triggers one refresh and one retry. A server route such as `/api/bff/tasks` therefore never receives the refresh cookie and cannot refresh on its own.

**Decision.** The server layer passes an upstream 401 through. The page's client (`adapters/http/client.ts`) then calls `POST /api/bff/auth/refresh` once, which does receive the cookie, and retries the original call once. Concurrent 401s share one refresh. If the refresh fails the session ends and the person goes to the login page. No token is ever visible to the page: it only sees status codes. This is the same flow as the pack's sequence diagram, with the refresh hop moved to the browser's side of the server layer.

**Route guard.** Page requests do not carry the path-limited refresh cookie either, and the access cookie is gone after 15 minutes, so a guard that looked for a token would send a person with a valid 7-day session to the login page. The server layer therefore also sets a marker cookie (`__Host-ih_s`, value `1`, HttpOnly, 7 days) that only says "a session exists". It holds no token and grants nothing; every API route still authenticates on its own (TH-413).

**Task 1 screens the API cannot serve.** Password reset, changing the password or the email, avatar upload and deleting an account have no API behind them, and password reset and email verification are out of scope for Task 4 (section 2). The HTTP adapter answers these with `NOT_SUPPORTED` (501) and the screens show the failure state. Registering signs the person in (FR-401), as the pack requires; the Task 1 mock keeps its earlier behaviour for its own tests.

**Lists.** The screens keep their whole-list behaviour, so the adapter reads pages of 100 up to 1000 rows. That fits a small team; server-side paging in the screens is a follow-up (docs/blockers.md, B-403).
