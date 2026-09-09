# Demo Video Script

Target length: **3:00–3:30** (within the guide's 2–5 minute range).
Record against `npm run dev` (needed for the loading/error-state beats —
the "Simulate error" toggle is dev-only) at a desktop viewport, then a
quick resize/DevTools pass for the responsive beat.

| Time | Beat | Say | Show |
| --- | --- | --- | --- |
| 0:00–0:15 | Cold open — app running end-to-end | "This is a Developer Productivity Dashboard — see where every project stands, at a glance. Built with Next.js, TypeScript, and Tailwind." | Dashboard already loaded at `localhost:3000`, full page visible. |
| 0:15–0:45 | Main features, part 1 — dashboard | "The activity strip up top gives open/blocked/in-progress counts. Each project card shows a segmented progress bar computed from its own tasks — no separate progress field, it's derived live." | Point at StatsStrip, hover/scroll across the three ProjectCards. |
| 0:45–1:15 | Main features, part 2 — search & filter | "Search matches project names and task titles together. The status chips narrow the task list — watch: filtering to Blocked leaves the project grid untouched, since projects don't have a status of their own." | Type a search term, clear it, click the "Blocked" chip, point out the task list narrows while ProjectGrid doesn't. |
| 1:15–1:45 | Main features, part 3 — navigation | "Clicking a project card goes to its own detail page — same TaskList and ProgressBar components, just scoped to one project's tasks." | Click "Atlas API Gateway", show the detail page, click "← Dashboard" to return. |
| 1:45–2:15 | Loading / empty / error states | "Every dynamic view has all four states. Empty isn't blank — it tells you whether there's no data or your filters excluded everything, with a Clear filters action. And there's a dev-only error toggle so I can show what a failed fetch looks like." | Reload to catch the skeleton loading state; search to zero results for the empty state; toggle "Simulate error (dev only)" and click Retry. |
| 2:15–2:45 | Responsive pass | "It's been checked at 375, 768, and 1280 pixels with headless Chromium for zero horizontal scroll — the project grid goes from one column to three, task rows stack their metadata under the title on mobile." | Open DevTools device toolbar, step through mobile → tablet → desktop widths live. |
| 2:45–3:15 | Technical detail | "Every status badge pairs an icon shape with text, never color alone — that's a real WCAG requirement, diff-style red/green is the most common colorblind confusion pair. The whole design system is CSS custom-property tokens in one file, and every fetch goes through one shared `useAsync` hook, so loading/error/success is the same contract everywhere instead of being reimplemented per component." | Quick cut to `app/globals.css` design tokens, then `lib/useAsync.ts`, then `StatusBadge.tsx`'s icon-shape map. |
| 3:15–3:30 | Close | "Full source, README, and tests are in the GitHub repo linked below." | Back to the dashboard, or the GitHub repo page. |

## Notes for whoever records this

- The dev-only error toggle and the loading-state skeleton only exist in
  `npm run dev` — don't record this against `npm run start` / a
  production deployment or those two beats won't be reachable.
- `npm run test` (18 passing tests) is worth a 2–3 second cut if there's
  time left in the 5-minute ceiling, but it's not required — the guide
  asks for the app running, not the test suite.
