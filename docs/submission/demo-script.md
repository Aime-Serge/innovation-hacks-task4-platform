# Demo script (target 4 minutes 30 seconds, inside the guide's 2 to 5 minutes)

The guide (section 09) asks the video to show: the application running end to end, main features in action, key technical implementation details, and the final result. The four segments below map to those four items. The timings are a plan on paper; the recorded length is not known until you record. Rehearse once with a stopwatch and trim to stay under 5 minutes.

Before recording: use a fresh throwaway account and synthetic data; keep dashboards, terminals, `.env` files and the provider key out of frame; do not use confidential text, because project text goes to an external AI provider. Screens marked (feat/minimal-profile) exist only after that branch is merged and deployed.

## Segment 1: The application end to end (about 1 minute 30 seconds)

| Time | Show | Say |
|---|---|---|
| 0:00 to 0:20 | The live site; open a protected address such as `/projects` and get sent to sign in | "A protected route sends me to sign in." |
| 0:20 to 0:55 | Register in two steps (feat/minimal-profile): account, then professional details and consent | "Each step is validated by the server before anything is created." |
| 0:55 to 1:30 | Land on the dashboard with the welcome banner and completeness; open the profile page | "Registration signs me in and shows how complete my profile is." |

## Segment 2: Main features in action (about 1 minute 45 seconds)

| Time | Show | Say |
|---|---|---|
| 1:30 to 1:50 | Create a project | "Project management: create, edit, view." |
| 1:50 to 2:35 | Open the project, generate tasks with AI, edit one title, untick one, add the selected ones | "The AI only suggests; nothing exists until I confirm." |
| 2:35 to 3:00 | Create a task and assign it with the people picker showing discipline and company (feat/minimal-profile); change its status | "The picker shows who each person is." |
| 3:00 to 3:15 | The dashboard: statistics, progress and recent activity | "These numbers come from real data." |

## Segment 3: Key technical details (about 1 minute)

| Time | Show | Say |
|---|---|---|
| 3:15 to 3:35 | The architecture diagram in the README | "The browser talks only to the Next.js site; the session lives in HttpOnly cookies." |
| 3:35 to 3:55 | The named database constraints or the migration for profiles (feat/minimal-profile) | "Every profile rule is enforced by the database as well as by the API and the form." |
| 3:55 to 4:15 | `docs/guide-compliance.md` or `make gate` output | "Each guide requirement has evidence, checked by a make target." |

## Segment 4: The final result (about 15 seconds)

| Time | Show | Say |
|---|---|---|
| 4:15 to 4:30 | Change password or sign out from Settings, then try a protected address and be sent to sign in again | "Signed out, and the protected route is closed again." |

## Checklist

- [ ] Recorded length is between 2:00 and 5:00 (write the real length here after recording: `<set-me>`).
- [ ] No secret, token, connection string or real personal data is visible.
- [ ] The link works when signed out of the hosting account. Then paste it into the README (Demo row and Task submissions table).
