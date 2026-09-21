# Demo video script (about 5 minutes)

No secret may be visible: use a fresh throwaway account, keep the dashboards, terminals and `.env` files out of frame, and do not show the provider key or any connection string. Do not use confidential data: project text goes to an external AI provider.

1. **Register (30 s).** Open the live site. Try a protected address such as `/projects`: you are sent to log in. Create an account; you land signed in on the dashboard.
2. **Create a project (30 s).** Projects → New project, with a name, description and due date.
3. **Generate tasks with AI (90 s).** Open the project. Point at "Generate tasks". The privacy notice appears first; accept it. Type a one-line brief and generate. Point out the label "AI-generated, review before adding", edit one title, untick one suggestion, and press "Add selected". Show that the tasks exist only now.
4. **Use the AI's other two features (30 s).** "Suggest priorities": show current and suggested priority with the reason, accept one. "Summarise project": show the summary, risks and next steps.
5. **Change a status and show the dashboard (45 s).** Move a task through its allowed statuses; open the dashboard: statistics, progress and recent activity are real.
6. **Show one AI failure state (30 s).** Either set `AI_ENABLED=false` on the API (the AI actions disappear from the page while everything else keeps working), or lower `AI_DAILY_LIMIT_PER_USER` to 1 and generate twice (the limit message with the wait time). Restore the setting afterwards.
7. **Isolation (30 s).** In a second browser profile, register another account: it cannot see the first account's project, and a copied project address shows a not-found page.
8. **Sign out (15 s).** Sign out from the account menu; go back to a protected address: you are sent to log in again.

Say out loud, in one sentence each: the browser only talks to the site, the session is in HttpOnly cookies, and the AI only suggests.
