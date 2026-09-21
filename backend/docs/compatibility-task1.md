# Task 1 compatibility

Phase 8 of the pack: generate types from `docs/openapi.json` and check them against the Task 1
dashboard's own Zod-inferred types (`src/schemas/index.ts`, `src/services/types.ts`). Command in
`scripts/compat/README.md`. Result of the run against this branch:

**Matches.** All enum values (`TaskStatus`, `Priority`, `ProjectStatus`, `Role`, `Theme`,
`ActivityType`); field names and casing on `Task`; the error envelope `{ error: { code, message } }`
(the API adds `requestId` and `details`, which Zod's default object parsing ignores); the list
shape `{ items, total }` (the API adds `page` and `pageSize`); the repeated `status`, `priority`
and `projectId` query parameters; and `sort` by `dueDate`, `priority`, `title`.

**Compile errors when the API's types are assigned to Task 1's types (3), all on nullability:**

| Type | Field | Task 1 | Task 2 API | Fix in the adapter or schema |
| --- | --- | --- | --- | --- |
| `Project` | `dueDate` | `string` | `string \| null` | Task 1 schema `nullable(IsoDate)`, and show "No due date" (ADR-218) |
| `User` | `avatarUrl` | `string \| undefined` | `string \| null` | `nullish(string())`, or map `null` to `undefined` in the adapter |
| `Activity` | `taskId` | `string \| undefined` | `string \| null` | same as above |

**Differences the adapter must translate (not type errors):**

- `GET /activity` and `GET /users` return the common page object; Task 1's `ActivityService.list`
  and `UserService.list` return arrays. Read `.items` (ADR-217).
- Task 1 sorts with `sort: "due_date"` and `dir: "asc" | "desc"`; the API wants `sort=dueDate` or
  `sort=-dueDate`.
- Task 1 `TaskQuery.assigneeId` is a single id or null; the API accepts repeated `assigneeId`.
- Task 1 has no `overdue`, `dueBefore` or `dueAfter` filters yet; the API offers them.
- Task 1 limits (`description` 500 and 1000 characters) are stricter than the API's (2000 and 4000).
  The API is the wider of the two, so nothing valid in the dashboard is refused.

**Task 1 features the Task 2 pack has no endpoint for.** These are gaps to raise for Task 4, not
things this API invents: forgot and reset password, change password, change email, avatar upload
and delete, and self-service account deletion (only a lead can `DELETE /users/{userId}`).
`PATCH /users/{userId}` accepts `name`, `avatarUrl`, `preferences` and (lead only) `role`.

The Task 1 dashboard was not modified. It still runs on its mock adapter.
