# Demo video script

Target length: **3:30 to 4:00** (the guide asks for 2 to 5 minutes). Record
against the deployed site or `npm run build && npm start`. The scenario switcher
works in both, so every state is reachable. Use a desktop window first, then
resize (or DevTools device mode) for the responsive beat.

| Time | Beat | Say | Show |
| --- | --- | --- | --- |
| 0:00 to 0:20 | Open | "This is DevDash, a developer productivity dashboard. Task 1 of my internship: strict TypeScript, Next.js, running on a mock service layer that Task 2's API will replace." | Land on `/login`. Log in with `aime.serge@example.com` / `password123` |
| 0:20 to 0:50 | Dashboard | "Four KPIs, upcoming deadlines for the next 7 days, and recent activity. Every number is derived from the data: open tasks, overdue tasks, completion rate." | Point at each KPI, the deadline list, the activity feed |
| 0:50 to 1:20 | Projects | "Each project card shows status, due date, progress and task counts. Long names truncate with a tooltip. Open a project to see its progress ring and its tasks." | `/projects`, then open one project; show the ring and the task cards |
| 1:20 to 2:00 | Tasks: search, filter, sort | "Search is debounced and announces the result count. Filters combine: values inside one filter are OR, different filters are AND. All of it lives in the URL, so I can reload or share this exact view." | Type a search, tick two statuses and a priority, sort by title, reload the page, then Clear filters |
| 2:00 to 2:20 | Optimistic update | "Changing a status updates instantly. If the service fails, it rolls back and shows an error toast." | Switch the scenario to `update-fails` and change a status |
| 2:20 to 3:00 | Every state | "Every dynamic region has loading, empty, no-results and error states. Nine scenarios, one switch." | Cycle `loading`, `empty`, `error` (press Retry), `partial-error` (page still works), `large`, `edge-text` |
| 3:00 to 3:25 | Responsive and themes | "360 pixels up to ultra-wide, no horizontal scroll. Sidebar becomes a drawer under 1024 pixels with a focus trap. Light, dark or system, with no flash." | Resize, open the drawer, press Escape; toggle the theme |
| 3:25 to 3:50 | Engineering | "The gate runs typecheck, lint, unit and end-to-end tests, axe accessibility on every route in both themes, Lighthouse and a security audit. Types come from Zod schemas, layers are enforced by ESLint, and a nonce-based CSP protects the page." | Show `npm run gate` output or the README gate table |
| 3:50 to 4:00 | Close | "Source, README and decision records are in the repo linked below." | The GitHub repo page |

## Notes for whoever records this

- Do not read out the demo password as anything real; it is a mock account.
- The mock account list lives in `localStorage`, so use one browser profile and do not clear site data mid-recording.
- Keep the scenario in the URL (`?scenario=`), it makes retakes repeatable.
- Record the gate output from a real run. Do not claim a result you have not just seen.
