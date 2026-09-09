# Handoff Artifact: Frontend Engineer → QA Engineer

Note on scope: this pass also lands the AI Engineer's backend deliverable
(`feat(ai)`) — it existed unwritten-to-git in the working tree and the
frontend's own build order needed it to wire step 6, so it's included
here as its own clearly-scoped commit rather than left blocking.

## Screens Implemented

- `/login`, `/register` — field + banner errors matching the backend's
  exact contract (generic 401 message, 409 -> "account exists, log in
  instead" hint under the email field).
- Protected routing — `proxy.ts` (this Next version renamed
  `middleware.ts`; verified against a live dev server, not just
  type-checked) redirects unauthenticated visitors to `/login?next=...`
  and redirects an authenticated session away from `/login`/`/register`.
  `AuthProvider` covers the case proxy can't: a cookie present but
  expired/invalid server-side.
- Dashboard (`/`) — real stats, real project grid, real task list, "New
  Project" -> `ProjectFormModal`.
- Project detail (`/projects/[id]`) — Edit/Delete actions, "New Task",
  per-task status quick-select + assignee chip + Edit/Delete, search +
  status/priority filter (client-side over the fetched set, same pattern
  the dashboard already used), and the AI panel.
- AI panel (`GenerateTasksPanel`) — trigger -> loading skeleton ->
  editable checklist (per-row checkbox/title/priority-cycle) -> "Add N
  tasks". `source: "fallback"` renders identically with a neutral
  `NoticeBanner` instead of error styling.

## Integration Confirmation

`grep -rn "mock-data\|simulateError" frontend/app frontend/components frontend/lib`
returns nothing. `lib/mock-data.ts` and its test are deleted, not
patched. Every list/detail screen reads from `lib/data.ts`, which calls
the real backend and adapts its snake_case DTOs to the frontend's
existing camelCase types.

## Verification actually performed

- `tsc --noEmit`: clean (ignoring one pre-existing Next-typegen artifact
  unrelated to this work — `LayoutProps` isn't generated until a build/
  dev run creates `.next/types`).
- `vitest run`: 15/15 passing throughout.
- Live dev server (`next dev` on port 3000, fresh `.next`): confirmed
  `proxy.ts` actually redirects (not just compiles) — `/` and
  `/projects/:id` unauthenticated -> 307 to `/login?next=...`; `/login`
  and `/register` serve 200 directly.
- `scripts/qa-checks.mjs` (Playwright + axe, rewritten for the
  auth-gated app) against that live server: 10/10 passing after fixing
  one real finding (see below).

**What's NOT verified**: the authenticated flows (dashboard with real
data, project/task CRUD, the AI panel end-to-end, responsive/axe checks
on those screens) — Docker is blocked in this session (user is in the
`docker` group per `/etc/group`, but this shell's process predates that
change; no `sg`/`newgrp` available to work around it), so there's no
local Postgres to log in against. These need either a fresh terminal
locally or get exercised for real at deploy time.

## Real bug found and fixed

Axe flagged `link-in-text-block` on both auth pages: the "Create one" /
"Log in" / "Log in instead?" links used `hover:underline` only, so
outside of `:hover` they're distinguished from surrounding text by color
alone — fails WCAG 1.4.1. Fixed to underline by default
(`hover:no-underline`).

## Arranged Commit List

```
b982a57 feat(frontend): add register and login pages
98d3815 fix(frontend): track .env.example despite the blanket env-files gitignore rule
96e4546 feat(frontend): add protected route wrapper and logout
1155ae6 refactor(frontend): replace mock data with live API calls
a663b4a feat(frontend): add project CRUD screens
70a41d8 feat(frontend): add task assignment, priority, due date, search, filter
eaaefc4 feat(ai): add AI-assisted task generation with a real fallback
b19a508 fix(frontend): rename middleware.ts to proxy.ts (Next 16 convention)
37d4094 feat(frontend): wire AI feature UI to backend
e2f9f9f style(frontend): responsive and accessibility pass
```

Two unplanned fix commits (`.env.example` gitignore, `proxy.ts` rename)
were folded in at the point each was discovered rather than silently
bundled into an unrelated feature commit.
