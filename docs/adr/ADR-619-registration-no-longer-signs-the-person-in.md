# ADR-619: Registration no longer signs the person in; it sends them to log in

**Status:** Accepted (explicit product decision, reversing part of MF-01).

**Context.** MF-01 originally specified "a successful registration signs the person in," and
2026-09-22's frontend supersession (`docs/supersession-log.md`) implemented that: `RegisterForm`
called `register()` then `login(email, password)` itself and always landed on the dashboard,
matching Task 1's HTTP-adapter behaviour at the time.

**Decision.** `RegisterForm.submit()` no longer calls `login()`. On success it now only arms the
welcome-banner flag and sends the browser to `/login?registered=1` (`LoginForm` already renders
`t("auth.registered")` — "Account created. Log in to continue." — for that query param; this
code path existed and was tested but unused since the auto-login change). The person types the
password they just chose, once, to actually start a session.

This is a deliberate reversal of MF-01's "signs in automatically" clause, requested explicitly
as a security posture: the app no longer treats "the registration form was submitted" as proof
that the submitter controls the credentials, the way an explicit login does. It also makes Task
4 match Task 1's dashboard repo, which never adopted the auto-login behaviour in the first place
(`tests/unit/shell.test.tsx`'s "TC-005 registering creates the account and sends the user to the
login page, not the app" — Task 1 was right the whole time; Task 4 is the one that changes here).

**What did not change.** Registration itself, its validation, the role dialog (ADR-618), and the
welcome banner's one-time appearance (`devdash_show_welcome`, still armed at registration, still
consumed on the next dashboard mount — now after a real login rather than an auto-login).

**Where it lives.** `frontend/src/features/auth/RegisterForm.tsx::submit`,
`frontend/tests/unit/register-wizard.test.tsx` (renamed the affected test, added a
`hardNavigate` mock so the destination is actually asserted instead of only inferred from
`sessionStorage`).
