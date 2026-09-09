# Frontend — AI-Powered Project & Task Management Platform

Next.js 16 (App Router) frontend for Task 4 (capstone) of the Innovation
Hacks Full Stack Development Internship. Full setup, environment
variables, and feature documentation live in the
[repo root README](../README.md) — this file is a quick reference for
working inside `frontend/` specifically.

## Quick reference

```bash
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_URL -> your running backend
npm run dev
```

- App: `http://localhost:3000`
- Tests: `npm test` (Vitest, 15 tests) · `npx tsc --noEmit`
- Browser/accessibility QA (needs `npm run dev` running):
  `BASE_URL=http://localhost:3000 node scripts/qa-checks.mjs`

Route protection lives in `proxy.ts` at the repo root — this Next.js
version renamed the `middleware.ts` convention; see
[`docs/handoffs/05-frontend-engineer.md`](../docs/handoffs/05-frontend-engineer.md)
for why.
