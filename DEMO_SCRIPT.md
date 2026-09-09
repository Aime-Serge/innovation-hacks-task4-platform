# Demo Video Script

Target length: **3:00–3:45** (within the guide's 2–5 minute range).
Record against the live deployment if it's up (best case — shows real
production behavior), otherwise `npm run dev` + `uvicorn` locally with a
real `DATABASE_URL` migrated and, ideally, a real `ANTHROPIC_API_KEY` set
(the AI beat works either way, but showing the real `source: "ai"` path
once is worth it if a key is available).

| Time | Beat | Say | Show |
| --- | --- | --- | --- |
| 0:00–0:15 | Cold open | "This is the capstone of a full-stack internship — an AI-powered project and task manager with real authentication and a real database, built on top of a frontend, API, and DB layer from three earlier tasks." | Land on `/login` already loaded. |
| 0:15–0:45 | Register → login | "Registration hashes the password with Argon2id — never stored in plaintext. The session is an httpOnly cookie, so this app's own JavaScript never touches the raw token." | Fill the register form, submit, land on the dashboard already logged in. |
| 0:45–1:10 | Dashboard overview | "Everything here is real data from the API — active projects, open/in-progress/blocked task counts, per-project progress computed live from that project's own tasks." | Point at the stats strip, scroll the project grid. |
| 1:10–1:50 | Create a project and tasks | "Creating a project is one form — name and an optional description, owner comes from the session, never from client input. Same pattern for tasks." | Click "New Project," fill it in, submit; open it, click "New Task," create two or three tasks. |
| 1:50–2:30 | Assign, prioritize, search, filter | "Every task can be assigned to any user, given a priority and due date, and its status changed right from the row. Search and the priority/status filters combine." | Edit a task: set priority, due date, assign it. Type a search term. Toggle a priority filter. |
| 2:30–3:05 | Trigger the AI feature | "One click generates a set of candidate tasks from the project's name and description. Each one's editable, and only the checked ones get added as real tasks." | Click "Generate tasks with AI," show the loading state, then the checklist — edit one title, uncheck one, click "Add N tasks." |
| 3:05–3:20 | Logout → protected routes | "Logging out actually ends the session — not just a UI change." | Click Sign out, then try to load the dashboard URL directly, show the redirect to `/login`. |
| 3:20–3:35 | *(if deployed)* Live | "And this isn't just running locally — it's deployed." | Cut to the live URL, repeat one or two clicks there. |
| 3:35–3:45 | Close | "Full source, the security review, and the whole role-by-role build record are in the GitHub repo linked below." | Back to the app, or the GitHub repo page / `docs/handoffs/`. |

## Notes for whoever records this

- The AI beat: if `ANTHROPIC_API_KEY` isn't set, the panel still works —
  it shows the same checklist with a quiet "AI suggestions aren't
  available right now" notice instead of an error. That's honest,
  intended behavior, not a bug to hide; call it out on camera if it
  happens rather than re-recording to avoid it.
- Skip the "(if deployed)" beat entirely if there's no live URL yet —
  it's optional per the submission guide.
- `pytest` (89 tests) and `npm test` (15 tests) are worth a 2–3 second
  cut if there's time left, but — same as Task 1's script — the guide
  asks for the app running end-to-end, not the test suite.
