# Task 4 frontend

This directory contains the platform's Next.js 16 and strict TypeScript frontend. It renders the dashboard, projects, tasks, auth, profile and settings workflows, and calls the FastAPI service through the same-origin `/api/bff` server layer. The browser does not read session tokens; cookies are HttpOnly. Product behaviour and API contracts are documented in the [repository README](../README.md) and [API README](../backend/README.md).

![Task 4 dashboard, desktop](../docs/screenshots/task-4/03-dashboard-desktop.png)

## Screens and user flows

| Screen or flow | What a user can do |
|---|---|
| `/login`, `/register` | Authenticate or create an account and professional profile |
| `/` | Review project and task metrics, deadlines and recent activity |
| `/projects`, `/projects/[id]` | Find projects, create and edit a project, track progress and use project AI actions |
| `/tasks` | Search, filter, sort, create, assign and update tasks |
| `/profile`, `/people/[id]` | Edit own professional details and view permitted member details |
| `/settings` | Manage preferences, privacy, password and sessions |

### Authentication and planning

![Login page](../docs/screenshots/task-4/01-login-desktop.png)

![Registration page](../docs/screenshots/task-4/02-register-desktop.png)

![Dashboard page](../docs/screenshots/task-4/03-dashboard-desktop.png)

### Projects, tasks and assignment

![Projects page](../docs/screenshots/task-4/04-projects-desktop.png)

![Tasks page](../docs/screenshots/task-4/05-tasks-desktop.png)

![Task assignee picker](../docs/screenshots/task-4/09-task-assign-picker-desktop.png)

### Responsive layouts and account settings

![Dashboard on mobile](../docs/screenshots/task-4/03-dashboard-mobile.png)

![Own profile page](../docs/screenshots/task-4/06-profile-desktop.png)

![Settings page](../docs/screenshots/task-4/07-settings-desktop.png)

![Member profile page](../docs/screenshots/task-4/08-member-profile-desktop.png)

All Task 4 screenshots, including mobile variants, are embedded in the [root README screenshot gallery](../README.md#screenshots). Remaining standard evidence that requires live accounts or manual capture is explicitly listed there; generated images do not claim live AI or cross-account verification.

## Local frontend development

Run the full platform from repository root:

```bash
make env
make up
```

The frontend is available at `http://localhost:3000`; API calls are proxied through `/api/bff`. Frontend-only commands from this directory:

```bash
npm ci
npm run dev
npm run typecheck
npm test
npm run test:e2e
```

For the complete stack, security scan, docs and release checks, use `make gate` from repository root. See [frontend package scripts](package.json) and [contributing guide](../CONTRIBUTING.md).
