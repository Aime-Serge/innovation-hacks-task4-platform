# ADR-618: Self-registration may set role=lead, removing the prior anti-escalation guardrail

**Status:** Accepted (explicit product decision, requested during the role-dashboard feature).

**Context.** The Developer vs Team Lead pack (RF-01–RF-03) specifies a registration dialog
that submits the existing `users.role` field, defaulting to `developer`, on `POST /users`. As
shipped, `POST /users` never read a `role` from the request at all: `UserCreate` had no `role`
field, and the handler's own docstring said "The role is always `developer`; only a lead can
change it later." That was a deliberate guardrail — nobody could self-register with team-wide
read visibility (BR-401: a lead reads every project and task; everyone else reads only their
own).

**Decision.** Implementing the pack as specified requires removing that guardrail: anyone who
registers can now choose `role: "lead"` directly, and `GET /dashboard/summary`, `GET /tasks`,
`GET /projects`, and `GET /activity` will show them everything from their first session, with
no promotion step and no existing lead's approval.

This was flagged explicitly before implementation, since it is a real change to who can see
what in the system, not a UI-only change. The decision to proceed was made deliberately,
understanding that trade-off, rather than assumed as the "safe default."

**What did not change.** `UserUpdate.role` (changing an *existing* account's role after
registration) is still lead-only, unchanged, per TC-307/TC-309 (last lead cannot be demoted or
deleted). `read_scope` (BR-401) itself is untouched — a self-registered lead gets exactly the
same scope any other lead gets, nothing more.

**Where it lives.** `app/schemas/users.py::UserCreate.role`, `app/api/v1/users.py::register`,
`backend/tests/api/test_auth_users.py::test_tc203b_registration_may_set_role_lead` (also
renamed `test_tc203_client_cannot_set_role_id_or_timestamps` to
`test_tc203_client_cannot_set_id_or_timestamps`, since `role` is no longer a rejected field).

**Revisit if:** this ships to a setting with untrusted public registration (the pack's own
guide context is an internship submission with a small, known user set); at that point the
registration dialog's "I'm a team lead" choice should instead request promotion from an
existing lead rather than grant it directly.
