# ADR-010: keep the mock login flow

**Status:** Accepted. Deviation from TH-08 and from "real authentication is out of scope".

**Context.** The baseline shipped register, login, forgot and reset password against a mock, and the project's other tasks are presented together. The Pack treats real authentication as Task 2 work and forbids sensitive data in `localStorage` (TH-08).

**Decision.** Keep the four screens, behind the `AuthService` interface, with a mock adapter. The mock does three things a real service will also do: registering never starts a session (the user lands on the login page), unknown emails and wrong passwords give the same message, and the forgot-password reply never reveals whether an account exists.

**Deviation, stated plainly.** The mock stores accounts, including plain-text passwords, in `localStorage`, and the session is an unsigned `mock_session` cookie that the route guard checks for presence only. Nothing here is secure and nothing here is meant to be. It exists so the guarded routes can be demonstrated. The `AuthService` interface is what Task 4 replaces with the real API (Argon2id, signed JWT in an HttpOnly cookie).

**Consequence.** Do not enter a real password in this build.
