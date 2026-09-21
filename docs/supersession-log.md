# Supersession log

Every earlier test or rule changed by Task 4, with the old assertion, the new one and the reason (pack section 1, TC-463).

| Date | Test or rule | Old assertion | New assertion | Reason |
|---|---|---|---|---|
| 2026-09-21 | Task 3 `test_tc322_missing_secret_stops_startup_and_names_the_variable` | The startup error names `SECRET_KEY` | The startup error names `JWT_SECRET` (both variables are unset first) | ADR-418, the pack's variable name. Not one of S1 to S8; recorded as a deviation. |
| 2026-09-21 | Task 3 test settings helper and `test_fr321_the_seed_command_refuses_production_and_an_unconfirmed_reset` | Production settings needed no AI settings | Production settings name a live provider, key and model | FR-427: production refuses the fake provider. The tests still prove what they proved before. |
| 2026-09-21 | S1 Task 2 `test_tc212_project_list_filters_sorts_and_pages` | A developer lists all four projects, including another user's | The same assertions, read as a lead (who sees every project) | BR-401: a developer lists only readable projects |
| 2026-09-21 | S1 Task 2 `test_tc213_only_owner_or_lead_edits_and_deletes_project` | A non-owner gets 403 on change and delete | A stranger gets 404 (BR-402); a reader who is not the owner still gets 403 | BR-401, BR-402, BR-202 |
| 2026-09-21 | S1 Task 2 `test_tc223_task_create_and_delete_need_owner_or_lead` | A non-owner gets 403 creating a task in the project and 403 deleting one | A stranger gets 422 on the `projectId` field and 404 on delete; a reader (assignee in the project) still gets 403 | BR-401, BR-402, BR-203 |
| 2026-09-21 | S1 Task 2 `test_tc225_assignee_edits_task_but_stranger_cannot` | A stranger gets 403 editing the task | A stranger gets 404 | BR-402 |
| 2026-09-21 | S1 Task 2 `test_tc233_status_change_permissions_and_unknown_value` | A non-owner gets 403 changing status | A stranger gets 404; a reader who is not the task's assignee still gets 403 | BR-402, BR-203 |
| 2026-09-21 | S1 Task 2 `test_tc319_dashboard_summary_counts` | A developer's dashboard counts the whole seed | The same figures, read as a lead | BR-401: dashboard figures cover readable projects |
| 2026-09-21 | S6 Task 2 `test_tc300_reads_are_open_to_any_authenticated_user` (renamed `..._follow_the_visibility_matrix`) | Every project, task and activity read returns 200 for any signed-in user | Lists and the directory return 200; a single project, its tasks, or a task returns 200 to owner and lead and 404 to a stranger; the matrix labels match section 6 | Section 6 authorization and visibility matrix |
| 2026-09-21 | Task 3 `test_tc343_overdue_and_upcoming_follow_the_injected_date` | `dashboard.summary()` takes no caller | It takes an actor, here a lead | The service needs a caller to build the read scope; the assertion is unchanged. Not one of S1 to S8 by number. |
