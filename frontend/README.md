# Developer Productivity Dashboard

An at-a-glance status dashboard for developers checking their own project
and task status — built with Next.js (App Router), TypeScript, and
Tailwind CSS v4.

Built as Task 1 of the Innovation Hacks Full Stack Development
Internship. This is the frontend only: it runs against a typed mock-data
layer (`lib/mock-data.ts`) shaped to match the REST API Task 2 will
provide, so wiring in the real backend later is a drop-in swap of the
fetch functions, not a rewrite of any component.

## Demo

- **Demo video**: _add link here after recording_ — see `DEMO_SCRIPT.md`
  for the shot list (2–5 min, per the internship's Demo Video
  Requirements).
- **Live deployment**: not deployed for this task — optional per the
  submission requirements. `npm run build && npm run start` runs the
  production build locally; any of Vercel/Netlify/Render would work
  as-is with zero configuration (no environment variables to set).

## Screenshots

| Dashboard (desktop) | Dashboard (mobile) |
| --- | --- |
| ![Dashboard desktop](docs/screenshots/01-dashboard-desktop.png) | ![Dashboard mobile](docs/screenshots/02-dashboard-mobile.png) |

| Project detail | Task filter applied |
| --- | --- |
| ![Project detail](docs/screenshots/03-project-detail.png) | ![Filtered tasks](docs/screenshots/04-filtered-tasks.png) |

| Loading state | Empty state (no matches) | Error state (with retry) |
| --- | --- | --- |
| ![Loading state](docs/screenshots/05-loading-state.png) | ![Empty state](docs/screenshots/06-empty-state.png) | ![Error state](docs/screenshots/07-error-state.png) |

## Feature list

- **Dashboard home** (`/`) — the primary landing view: activity summary,
  project grid, and a cross-project "My tasks" list.
- **Project detail** (`/projects/:id`) — a project's own task list, so
  clicking a project card goes somewhere real instead of a dead link.
- **Navigation** — persistent nav bar with a skip-to-content link, a
  non-color-only active-route indicator, and a profile menu.
- **Profile section** — avatar/name in the nav, expandable dropdown,
  keyboard-dismissible (Escape, click-outside).
- **Project & task cards** — one shared visual system (spacing, corner
  radius, hairline border) driven by CSS custom-property design tokens,
  not per-component styling.
- **Progress indicators** — a segmented bar (git-diff-stat style) per
  project, computed from that project's own tasks.
- **Search & filter** — a live search over project names and task
  titles, plus a status filter (Todo / In progress / Done / Blocked)
  that narrows the task list.
- **Loading / empty / error states** — every data-bound view (stats,
  projects, tasks, profile) has all three, plus success: skeletons that
  mirror the real content's shape, an empty state that distinguishes "no
  data yet" from "your filters excluded everything," and an error state
  with a Retry action.
- **Responsive layout** — verified with headless Chromium at 375px,
  768px, and 1280px: no horizontal scroll at any width, the project grid
  reflows 1 → 2 → 3 columns, and task rows stack their metadata below
  the title on narrow screens.
- **Accessibility** — semantic landmarks (`<nav aria-label>`, `role="search"`,
  `role="group"`), visible focus rings, `aria-pressed`/`aria-current`
  where relevant, and status communicated via icon shape + text, never
  color alone (StatusBadge pairs each of the four statuses with a
  distinct icon: filled circle / half circle / hollow circle /
  triangle).

## Design direction

Rather than a generic SaaS look (glossy cards, drop shadows, an
arbitrary brand-blue badge system), this UI borrows the visual language
developers already use all day: a graphite (not pure-black) canvas like
a code editor, a monospace type role reserved for identifiers and
numbers (task counts, dates, progress fractions) paired with a plain
humanist sans for prose, and a muted diff-inspired status ramp (green /
amber / slate-blue / muted red) instead of a generic color scale.
Progress reads as a segmented bar — closer to `git diff --stat` — rather
than a circular donut, which scales better in a dense list.

## Technology stack

- [Next.js 16](https://nextjs.org) (App Router, Turbopack)
- [React 19](https://react.dev) + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com) (CSS-based `@theme` design tokens)
- [Vitest](https://vitest.dev) + [Testing Library](https://testing-library.com) for component tests
- [Playwright](https://playwright.dev) for local browser verification during development (not part of the test suite)

## Getting started

Requires Node.js 20+ (developed and verified against Node 22).

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Other scripts

```bash
npm run build   # production build
npm run start   # run the production build
npm run lint    # ESLint
npm run test    # component test suite (Vitest)
```

### Environment variables

None required. This build has no real backend or third-party services —
`lib/mock-data.ts` simulates network latency and can simulate a failure
via a dev-only "Simulate error" toggle on the dashboard (stripped from
production builds via a `NODE_ENV` check). A `.env.example` will be
added once Task 2's API introduces a base URL to configure.

## Project structure

```
app/                       Routes (App Router)
  page.tsx                 Dashboard home
  projects/[id]/page.tsx   Project detail
components/
  nav/                     NavBar, ProfileMenu
  dashboard/               DashboardView, StatsStrip
  projects/                ProjectGrid, ProjectCard, ProjectDetailView
  tasks/                   TaskList, TaskCard
  controls/                SearchBar, FilterBar
  shared/                  StatusBadge, ProgressBar, Skeleton, EmptyState, ErrorState
lib/
  types.ts                 Project / Task / User shapes
  mock-data.ts              Mock fetch functions (shaped like the future REST API)
  useAsync.ts               Shared loading/error/success hook
  format.ts                 Date formatting
```

## Known gaps / assumptions

- **Filter scope**: search matches project name and task title; the
  status filter narrows tasks only (projects have no status field of
  their own). Priority and project filters are not implemented.
- **No auth yet**: the profile dropdown's Settings/Sign out items are
  presentational — Task 4 introduces real authentication.
- **Mobile nav**: no hamburger menu. The current IA has one persistent
  nav link ("Dashboard") plus the profile menu, both of which already
  fit at 375px without collapsing.
- **Environment setup deviation**: the original task brief specified
  `nvm install 20 && nvm use 20`. This machine already had Node 22
  globally and no `nvm` on PATH, so the project runs on the ambient
  Node 22 runtime instead, with all dependencies installed
  project-locally (no global installs).

## Testing

```bash
npm run test
```

18 tests across 7 files covering the mock-data progress calculation and
the shared/task/project components' loading, empty, error, and success
behavior. See `components/**/*.test.tsx` and `lib/mock-data.test.ts`.
