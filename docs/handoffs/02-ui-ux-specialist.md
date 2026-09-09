# Handoff Artifact: UI/UX Specialist → Solutions Architect

Extends Task 1's existing inventory (`NavBar`, `ProfileMenu`,
`DashboardView`, `StatsStrip`, `ProjectGrid`/`ProjectCard`,
`ProjectDetailView`, `TaskList`/`TaskCard`, `SearchBar`, `FilterBar`,
`shared/{Skeleton,EmptyState,ErrorState,ProgressBar,StatusBadge}`) and its
dark-first token system in `globals.css`. Nothing below replaces an
existing component; every item is additive or extends an existing one's
props.

## Screen Specs

### `/login`
Fields: email, password. Actions: Log in, link to `/register`.
- Client-side: required fields, basic email shape.
- Server-side error → 401: single non-field banner "Invalid email or
  password." (deliberately doesn't say which — matches the backend's
  constant-shape response, so the UI shouldn't leak more than the API does).

### `/register`
Fields: name, email, password, confirm password. Actions: Create account,
link to `/login`.
- Client-side: password ≥ 8 chars (mirrors backend's `min_length=8`),
  confirm-password match — both checked before submit, no round-trip
  needed.
- Server-side error → 409 (email exists): field-level error under the
  email input, "An account with this email already exists." + link to
  `/login`.
- Server-side error → 422 (weak password caught late, or malformed email):
  field-level error under the relevant input.

### Dashboard `/` (extended)
Unchanged layout (`StatsStrip` + `ProjectGrid`), now backed by real data.
Add: "New Project" primary action button in the page header, opening
`ProjectFormModal` in create mode.

### `/projects/[id]` (extended)
Add to the existing detail view:
- Header actions: Edit (pencil icon → `ProjectFormModal` in edit mode),
  Delete (trash icon → `ConfirmDialog`).
- "Generate tasks with AI" button, placed above the task list — see AI
  surface below.
- "New Task" button opening `TaskFormModal` in create mode, pre-filled
  with this project's id.
- Each `TaskCard` gains an overflow menu: Edit, Delete, Change status
  (quick-select, unchanged from today's status update flow).
- `FilterBar` extended with a priority filter (Low/Medium/High pills)
  alongside the existing status pills.

### AI Feature Surface: "Generate tasks with AI"
1. **Trigger**: secondary button, `Generate tasks with AI` with a small
   sparkle icon, next to "New Task". Opens an inline panel (not a route)
   directly under the button — same pattern as `FilterBar`'s inline
   controls, not a modal, so the task list stays visible for context.
2. **Loading**: button becomes disabled, label → "Generating…", inline
   panel shows 3 `Skeleton` rows (reusing the existing skeleton component)
   labeled "Thinking through your project…".
3. **Success (`source: "ai"`)**: panel shows the returned tasks as a
   checklist — each row: checkbox (default checked), editable title,
   editable description (collapsed by default, expand to edit), priority
   pill (click to cycle low/medium/high, same visual as `TaskCard`'s
   priority dot). Footer: "Add N tasks" (adds only checked rows via real
   `POST /tasks` calls) and "Discard".
4. **Fallback (`source: "fallback"`)**: identical checklist UI, but the
   panel header shows a quiet, non-alarming notice — same visual weight
   as `EmptyState` (neutral background, no red/alert styling, since this
   is a successful 200 response, not an error): *"AI suggestions aren't
   available right now — here's a quick-start checklist instead."* The
   user can still edit/select/add exactly as in the AI-success case; the
   feature never looks broken, only differently sourced.
5. **Hard failure** (network error before any response, e.g. request
   timeout client-side): this is the one case that *does* use
   `ErrorState`'s existing alert styling + Retry — because it's a genuine
   failure to reach the backend, not a backend-reported fallback.

### Task Management (extended)
- `TaskFormModal` fields: title, description, project (locked when opened
  from a project's detail page), status, priority (segmented control:
  Low/Medium/High), due date (native `<input type="date">`), assignee
  (`<select>` sourced from `GET /users`, with a "Loading team…" state
  while that list fetches, and "Unassigned" as the null option).
- `TaskCard` gains an assignee chip: initials in a small circle (reuses
  the initials pattern already used for the current user in
  `ProfileMenu`), tooltip with full name. Omitted entirely when
  unassigned — no empty chip.
- Due date rendering reuses the existing `formatDueDate` helper;
  overdue+not-done tasks get a subtle warning tint on the date text
  (new, small addition — not a new component).

## States

| Surface | idle | loading | success | error/empty |
|---|---|---|---|---|
| Login/Register | form enabled | button spinner, form disabled | redirect to `/` | field or banner error, form stays filled |
| Dashboard | — | existing `Skeleton` grid | real stats/cards | existing `EmptyState`/`ErrorState`, unchanged |
| Project CRUD modal | form enabled | button spinner | modal closes, list/detail refetches | inline field errors (422) or banner (404 on stale edit target) |
| Task CRUD modal | form enabled | button spinner | modal closes, task list refetches | inline field errors, assignee-not-found (404) surfaces under the assignee field |
| AI panel | button visible | skeleton rows, button disabled | checklist (ai-sourced) | checklist (fallback-sourced, neutral notice) **or** `ErrorState` (hard network failure only) |
| Delete confirm | — | button spinner | item removed from list | banner error, dialog stays open so the user can retry |

## Component Additions (extending Task 1's inventory)

New, generic (reusable across the additions below):
- `components/shared/Modal.tsx` — focus-trapped dialog shell, Escape +
  backdrop-click to close. Nothing in Task 1 has this yet; every new form
  below is built on it.
- `components/shared/ConfirmDialog.tsx` — built on `Modal`, used for
  project/task delete confirmation.
- `components/shared/FormField.tsx` — label + input/select + inline
  validation message, shared by auth and project/task forms so error
  styling is consistent everywhere.
- `components/shared/NoticeBanner.tsx` — the neutral (non-alarm) banner
  used by the AI fallback state and the register "email exists, log in
  instead" hint. Visually related to `EmptyState` but inline-sized, not
  a full block state.

Feature-specific:
- `components/auth/LoginForm.tsx`, `components/auth/RegisterForm.tsx`
- `components/projects/ProjectFormModal.tsx`
- `components/tasks/TaskFormModal.tsx`
- `components/ai/GenerateTasksPanel.tsx`

Extended (props added, existing behavior untouched):
- `FilterBar.tsx` — add optional priority-pills props.
- `TaskCard.tsx` — add optional `assignee` prop → renders the initials chip.
- `StatusBadge.tsx` — add the `blocked` entry to its existing
  `STATUS_META` lookup (the frontend's `TaskStatus` type already includes
  it; the backend now does too as of the auth/data-model migration).
- `NavBar.tsx` / `ProfileMenu.tsx` — Sign out gets a real `onClick`
  (calls the new auth context's `logout()`), and the static "currentUser"
  fetch is replaced by the real session (see Solutions Architect's data
  wiring).
