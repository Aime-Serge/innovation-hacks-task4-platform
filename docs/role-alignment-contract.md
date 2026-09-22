# Role-alignment contract (developer vs team lead)

Fixed decisions for this feature branch (`feat/role-alignment`), so every change reads from
the same facts instead of re-deriving them. Verified against the real code on 2026-09-22.

## What already existed (no change)

- `users.role`: `developer` | `lead`, `CheckConstraint`, default `developer`
  (`backend/migrations/versions/0001_initial_schema.py`), indexed (`ix_users_role`,
  migration 0002).
- `backend/app/services/visibility.py::read_scope` (BR-401): a lead reads everything; anyone
  else reads what they own or hold a task in. Already the single scoping function behind
  `tasks.py`, `projects.py`, `activity.py`, `dashboard.py`, and the AI service.
- `backend/app/services/dashboard.py::DashboardService.summary` (`GET /dashboard/summary`)
  already calls `read_scope` — a lead's numbers and upcoming deadlines are already team-wide,
  a developer's are already their own. **RF-05 is already satisfied**; no new endpoint, no new
  field. We do NOT add a `meta.scope` field — the frontend already has the caller's role on
  `User` (`useAuth().user.role`), so a redundant discriminator field would duplicate that.
- One dashboard route (`/`), one component (`DashboardView.tsx`). **RF-04 is already
  satisfied.**
- `backend/app/services/users.py::UserService.register` already accepts `role: Role =
  Role.DEVELOPER` as a keyword argument — the service layer was always able to create a lead
  account. **RF-03 (default developer) was already true at the service layer.**
- Indexes `ix_projects_owner_id` and `ix_tasks_assignee_id_status` (migration 0002) already
  cover the queries `DashboardService.summary` runs. No new index, no new migration.

## What was missing, and the one real gap found

`backend/app/api/v1/users.py::register` (the `POST /users` handler) never read
`payload.role` — it always called the service with the default, and its own docstring said
"The role is always `developer`; only a lead can change it later." That is a deliberate
anti-privilege-escalation guardrail: as shipped, nobody could self-register as a lead.

Implementing RF-01/RF-02 literally (a dialog that can set `role=lead` at signup) removes that
guardrail. This was flagged to the user explicitly; **the user's explicit decision (given the
guardrail's implication) was to remove it** — registration now honors `payload.role` when
present, defaulting to `developer` when absent, exactly as RF-01–RF-03 specify. See
`docs/adr/ADR-618-self-registration-may-set-role-lead-removing-the-guardrail.md`.

## The contract every piece below reads

- **Registration:** `POST /users` accepts the existing `role` field on `UserCreate`
  (`developer` | `lead` | omitted → `developer`). No new endpoint, no new field name.
- **Dashboard scope:** driven entirely by the already-authenticated `user.role` on the
  frontend (`useAuth().user.role`), not by any new API field. `DashboardView` renders:
  - `role === "lead"` → title `dashboard.title.lead`, KPI labels `kpi.*.team`, `TeamPanel`
    renders.
  - otherwise → title `dashboard.title.developer` (existing copy, relabelled), KPI labels
    `kpi.*.mine`, `TeamPanel` does not render and fetches nothing extra (it is a pure
    presentational component fed from the dashboard's *already-fetched* `tasks` and `users`
    queries — no new network request for either role).
- **TeamPanel data:** derived client-side from `useAllTasks()` (already scoped by `read_scope`
  — a lead's call already returns every visible task) grouped by `assigneeId`, joined against
  `useUsers()` (already fetched today for the people picker). Zero new backend calls.
- **DashboardPage prop:** none needed — the component reads role from `useAuth()` directly,
  matching how every other role-gated frontend surface in this repo already works (grep hits
  in `ProfileView.tsx`, `PeoplePicker.tsx`, etc.), rather than inventing a `role` prop pattern
  used nowhere else in the codebase.

## Explicitly not done

- No new database table, column, or migration.
- No new API endpoint or response field.
- No change to `read_scope`, `authz.py`, or who may call which endpoint — only the
  registration handler now forwards a field its own schema already declared.
