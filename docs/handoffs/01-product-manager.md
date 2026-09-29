# Handoff Artifact: Product Manager → UI/UX Specialist

## Objective (one sentence)

Ship one deployed application — a real-auth, real-database project and
task manager — that integrates the Task 1 frontend, Task 2/3 API, and a
Postgres database, plus one genuinely working AI feature.

## Acceptance Criteria

### 1. Authentication
- `POST /auth/register` creates an account with a hashed (never
  plaintext/reversible) password; returns 201 + an active session.
- `POST /auth/login` returns 200 + session on valid credentials; 401 on
  invalid, without revealing whether the email or the password was wrong
  (constant-shape response).
- `POST /auth/logout` invalidates the session — a subsequent
  `GET /auth/me` returns 401.
- Every project/task/user-mutation endpoint returns 401 to an
  unauthenticated caller.
- Frontend: an unauthenticated visitor hitting a protected route is
  redirected to `/login`; an authenticated session survives a page reload.

### 2. Dashboard
- Shows, computed from real API data (zero mock arrays): total projects,
  task counts by status (todo/in-progress/done/blocked), overall
  completion percentage, and a recent-activity list.
- Loading state while fetching, empty state for a zero-project account,
  error state with retry on fetch failure.

### 3. Project Management
- Create: `POST /projects` (owner derived from the session, never
  client-supplied) → 201.
- Edit: `PATCH /projects/{id}` → 200; only the owner may edit (404 for
  anyone else, not 403 — existence isn't revealed to non-owners).
- Delete: `DELETE /projects/{id}` → 204, cascades to its tasks.
- View: `GET /projects/{id}` renders full detail with its tasks.

### 4. Task Management
- Create: `POST /tasks` with title + project_id, optional
  priority/due_date/assignee_id → 201.
- Assign: `assignee_id` accepts any existing user id; UI offers a picker
  sourced from `GET /users`.
- Status: `PATCH /tasks/{id}/status`, enum-validated (422 on a bad value).
- Priority/due date: `PATCH /tasks/{id}` updates them independently, with
  explicit `clear_due_date`/`clear_assignee` flags to distinguish "leave
  unchanged" from "clear it".
- Search & filter: `GET /tasks?search=&status=&priority=&assignee_id=&project_id=`,
  all combinable; frontend search box + filter pills wired to real,
  server-backed results (not a client-side mock).

## Chosen AI Feature: AI-assisted task generation

**Why this one over the other four:**
- It has the cleanest UX hook already in Task 1's information architecture
  — a "Generate tasks with AI" action on the project detail page, right
  next to "add task" — no new page/flow needed.
- It's meaningful for a *brand-new* project (which is the common case at
  demo time), unlike task summarization or prioritization, which need an
  existing body of tasks to be interesting.
- It has a natural, honest fallback: a deterministic templated task
  breakdown (define requirements → design → build → test → document) that
  is still useful output, not an error state — satisfying "real fallback
  if the call fails" without faking AI involvement.
- It directly produces the domain object the rest of Task 4 already models
  (Task: title, description, priority) rather than free-text the UI would
  need new rendering for.

**Implementation contract:** `POST /projects/{id}/ai/generate-tasks`
returns 3-8 suggested `{title, description, priority}` tasks, sourced from
the Anthropic API (model read from env, forced-JSON via tool use) when
`ANTHROPIC_API_KEY` is set and the call succeeds, or the deterministic
fallback otherwise. The response is labeled `source: "ai" | "fallback"` —
visible to the UI and to a grader — so the feature is never dishonest
about which path ran.

## Submission Checklist For This Task

- [ ] GitHub repository — **mandatory** (public,
      `innovation-hacks-task4-platform`, in progress)
- [ ] Demo video (2-5 min) — **mandatory** (record after deploy)
- [ ] Live deployment link — optional (target: Render for API+DB, Vercel
      for frontend; deploy gated on a clean security review)
- [ ] LinkedIn post tagging Innovation Hacks — **mandatory** (publish after
      demo video is ready)
- [ ] README: install instructions, tech stack, feature list, screenshots,
      `.env.example` (no real secrets), demo link
