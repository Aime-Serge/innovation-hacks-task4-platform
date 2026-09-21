# Standards Pack read-back (Task 2)

Sources: `docs/standards/task2-standards-pack.md` (and `.pdf`), and
`docs/standards/task1-standards-pack.pdf` (text extract alongside). Both were read
in full before any code was written.

Verified counts, Task 2 pack: 12 sections; 34 functional requirements (25 Must,
9 Should); 25 non-functional requirements; 23 endpoint-catalogue rows (21 business
routes and 2 health checks). Task 1 pack: 12 sections; 24 functional (17 Must,
7 Should); 24 non-functional.

## a. Requirements

### Functional (M = must, S = should)

| ID | Pri | In one line |
| --- | --- | --- |
| FR-201 | M | `POST /users` registers; 201 + Location; no password data; duplicate email 409; role always developer |
| FR-202 | M | Password 12 to 128 chars, not equal to email, stored only as argon2id |
| FR-203 | M | `POST /auth/login` returns accessToken, tokenType, expiresIn; identical 401 for unknown email and wrong password |
| FR-204 | M | `GET /auth/me`; missing, expired or invalid token gives 401 UNAUTHENTICATED |
| FR-205 | M | `GET /users`: paginated, filter role, search q on name and email |
| FR-206 | M | `GET /users/{userId}`; 404 when unknown |
| FR-207 | M | `PATCH /users/{userId}`: self or lead; non-lead may change only name, avatar, preferences; role rules BR-208, BR-209 |
| FR-208 | S | `DELETE /users/{userId}`: lead only; 204; BR-207 and BR-208 as 409 |
| FR-209 | M | `POST /projects`: owner is caller; status defaults planned; 201 + Location |
| FR-210 | M | `GET /projects/{id}` with computed progress |
| FR-211 | M | `GET /projects`: filters status (repeatable), ownerId, q; sort dueDate, name, createdAt; each item has progress |
| FR-212 | S | `PATCH /projects/{id}`: partial, BR-202 |
| FR-213 | S | `DELETE /projects/{id}`: 204 when empty else 409 PROJECT_NOT_EMPTY |
| FR-214 | M | `POST /tasks`: status todo, priority default medium; unknown project 422; completed project 409 PROJECT_CLOSED; BR-203; 201 |
| FR-215 | M | `GET /tasks/{id}` |
| FR-216 | M | `GET /tasks`: q, status, priority, projectId, assigneeId, overdue, dueBefore, dueAfter; BR-05, BR-06; sorted, paginated |
| FR-217 | M | `PATCH /tasks/{id}`: title, description, priority, dueDate, assigneeId; `status` rejected with 422; BR-203 |
| FR-218 | M | `DELETE /tasks/{id}`: 204 no body; repeat gives 404 |
| FR-219 | M | `PATCH /tasks/{id}/status`: workflow, BR-204, BR-211; 409 INVALID_STATUS_TRANSITION lists allowed |
| FR-220 | S | `GET /projects/{id}/tasks`: same filters; unknown project 404 |
| FR-221 | S | `GET /activity`: newest first; limit default 10, max 50 |
| FR-222 | S | `GET /dashboard/summary`: activeProjects, openTasks, overdueTasks, completionRate, upcomingDeadlines (7 days) |
| FR-223 | M | Every route except register, login, health needs a valid token; BR-202, 203, 209 in one shared layer; 403 FORBIDDEN |
| FR-224 | M | One error envelope for every error class; no stack trace leaves the server |
| FR-225 | M | Validate every write; unknown fields rejected; strings trimmed; each invalid field listed |
| FR-226 | M | Status codes follow the section 6 decision table |
| FR-227 | M | Settings validated at startup; missing variable stops the app and is named; `.env.example` complete |
| FR-228 | M | Swagger UI, exported `openapi.json`, README with curl, Postman collection; summary, description, example, error responses per operation |
| FR-229 | M | Common list contract: page, pageSize (20, max 100), sort, `{items,page,pageSize,total}` |
| FR-230 | M | Business routes under `/api/v1`; health outside the version |
| FR-231 | M | CORS allowlist from environment; no wildcard |
| FR-232 | S | `X-Request-ID` accepted or generated; in response, envelope and every log line |
| FR-233 | S | `GET /healthz` liveness; `GET /readyz` readiness (503 when not ready) |
| FR-234 | S | `python -m app.seed`: default dataset; refuses in production; password from environment |

### Non-functional

| ID | Target | Tool |
| --- | --- | --- |
| NFR-201 | p95 list latency at most 150 ms | Locust |
| NFR-202 | p95 single read and write at most 100 ms | Locust |
| NFR-203 | Start to ready at most 5 s | startup test |
| NFR-204 | No 5xx leaks a stack trace | fault injection, fuzz |
| NFR-205 | Graceful shutdown within 30 s on SIGTERM | container test |
| NFR-206 | `mypy --strict` on app and tests, 0 errors | CI |
| NFR-207 | ruff lint and format, complexity 10 or less | CI |
| NFR-208 | 90% line coverage; each endpoint has a success and a failure test | pytest-cov, endpoint test |
| NFR-209 | Routers hold no business logic; layers point downward | import-linter |
| NFR-210 | No secrets in repo or history | gitleaks |
| NFR-211 | No high or critical dependency or code findings | pip-audit, bandit |
| NFR-212 | Passwords argon2id, never logged or returned | unit and log-scan tests |
| NFR-213 | Security headers on every response; `no-store` on auth | header test |
| NFR-214 | Body limit 1 MB, else 413 | API test |
| NFR-215 | CORS allowlist, no wildcard | CORS test |
| NFR-216 | Login and registration: 5 per minute per client and email, else 429 | API test |
| NFR-217 | JSON logs with request id, method, path, status, duration; no personal data or secrets | log test |
| NFR-218 | Liveness and readiness usable by an orchestrator | API test |
| NFR-219 | Every operation documented with examples and all error responses; OpenAPI valid | validator, doc test |
| NFR-220 | Property-based test of every endpoint, 0 failures | Schemathesis |
| NFR-221 | `/api/v1` changes additive only | OpenAPI diff |
| NFR-222 | 3-command setup; container runs non-root | CI, container test |
| NFR-223 | All configuration from environment, validated | settings tests |
| NFR-224 | Repository implementations interchangeable | repository contract suite |
| NFR-225 | Timestamps UTC ISO 8601 ending Z; dates YYYY-MM-DD | schema tests |

## b. Endpoint catalogue, status codes, error codes

Base `/api/v1`; health at `/healthz` and `/readyz`.

| Method | Path | Success | Errors |
| --- | --- | --- | --- |
| POST | /auth/login | 200 | 401 422 429 |
| GET | /auth/me | 200 | 401 |
| POST | /users | 201 | 409 422 429 |
| GET | /users | 200 | 401 422 |
| GET | /users/{userId} | 200 | 401 404 |
| PATCH | /users/{userId} | 200 | 401 403 404 409 422 |
| DELETE | /users/{userId} | 204 | 401 403 404 409 |
| POST | /projects | 201 | 401 422 |
| GET | /projects | 200 | 401 422 |
| GET | /projects/{projectId} | 200 | 401 404 |
| PATCH | /projects/{projectId} | 200 | 401 403 404 422 |
| DELETE | /projects/{projectId} | 204 | 401 403 404 409 |
| GET | /projects/{projectId}/tasks | 200 | 401 404 422 |
| POST | /tasks | 201 | 401 403 409 422 |
| GET | /tasks | 200 | 401 422 |
| GET | /tasks/{taskId} | 200 | 401 404 |
| PATCH | /tasks/{taskId} | 200 | 401 403 404 422 |
| PATCH | /tasks/{taskId}/status | 200 | 401 403 404 409 422 |
| DELETE | /tasks/{taskId} | 204 | 401 403 404 |
| GET | /activity | 200 | 401 422 |
| GET | /dashboard/summary | 200 | 401 |
| GET | /healthz | 200 | none |
| GET | /readyz | 200 | 503 |

Any endpoint may also give 404 (unknown path), 405, 413, 415; authenticated ones 500.

Status codes: 200 read or update; 201 created with Location; 204 delete; 400
unparseable JSON; 401 missing, invalid or expired credentials; 403 known but not
allowed; 404 unknown resource or route; 405 wrong method; 409 valid request that
conflicts with state; 413 body over 1 MB; 415 not application/json; 422 body or query
invalid; 429 rate limit with Retry-After; 500 generic fault with request id; 503
dependency unavailable.

Envelope: `{"error":{"code","message","details"?,"requestId"}}`. Codes:
MALFORMED_REQUEST 400, UNAUTHENTICATED 401, INVALID_CREDENTIALS 401, FORBIDDEN 403,
NOT_FOUND 404, METHOD_NOT_ALLOWED 405, EMAIL_ALREADY_EXISTS 409,
INVALID_STATUS_TRANSITION 409 (details list allowed statuses), PROJECT_NOT_EMPTY 409,
PROJECT_CLOSED 409, USER_OWNS_PROJECTS 409, LAST_LEAD 409, PAYLOAD_TOO_LARGE 413,
UNSUPPORTED_MEDIA_TYPE 415, VALIDATION_ERROR 422, RATE_LIMITED 429, INTERNAL_ERROR
500, SERVICE_UNAVAILABLE 503.

Authorization: anyone for register, login, health; any authenticated user reads
users, projects, tasks, activity and summary and creates projects; self updates own
profile; only a lead updates another user, changes roles, deletes users; owner or
lead updates or deletes a project and creates or deletes a task; owner, assignee or
lead updates task details and changes status.

## c. Business rules

Task 1 (now server-side): BR-01 status set todo, in_progress, in_review, done; BR-02
priority set low, medium, high, urgent; BR-03 progress is done over total rounded to a
whole percent, 0% when no tasks; BR-04 overdue is due date before today and status not
done; BR-05 search matches title and description, case-insensitive, trimmed; BR-06
filters AND across, OR within one filter.

Task 2: BR-201 email unique ignoring case, stored lowercase; BR-202 only owner or lead
edits or deletes a project; BR-203 task create and delete by owner or lead, edit by
owner, assignee or lead, status by assignee, owner or lead; BR-204 status follows the
workflow, same status is a 200 no-op with no activity; BR-205 a completed project
accepts no new tasks; BR-206 a project with tasks cannot be deleted; BR-207 a user who
owns projects cannot be deleted, otherwise deleting unassigns their tasks; BR-208 the
last lead cannot be deleted or demoted; BR-209 only a lead changes roles, new accounts
are developers; BR-210 ids are server UUIDs and timestamps server UTC; BR-211
completedAt set on entering done and cleared on leaving it.

Workflow: todo to in_progress; in_progress to in_review; in_review to in_progress or
done; done to in_progress. Anything else is 409.

## d. Contradictions, ambiguities and gaps (each has an ADR)

| # | Finding | Decision | ADR |
| --- | --- | --- | --- |
| 1 | Pack layout says `backend/` in a monorepo; this repository is the standalone Task 2 repository | Project stays at the repo root, as Task 1 did | ADR-212 |
| 2 | Pack says Python 3.12; the existing deployment pins 3.14 | 3.12 through uv; render.yaml updated | ADR-213 |
| 3 | Existing code is a different API: unversioned routes, no authentication, other shapes | Replaced wholesale. Not backward compatible; the live Render service changes when merged | ADR-214 |
| 4 | Existing `GET /` landing page; pack says only documented routes exist (TH-209) and unknown routes give 404 | Landing page removed; Swagger UI at `/docs` is the entry point | ADR-215 |
| 5 | Render health check uses `/health`; pack defines `/healthz` and `/readyz` | Health paths follow the pack; render.yaml updated | ADR-215 |
| 6 | Rate limit is per client AND email, but slowapi keys are computed before the body is parsed | Small in-process sliding-window limiter instead of slowapi | ADR-216 |
| 7 | FR-221 uses `limit`; FR-229 says every list uses page and pageSize | `/activity` returns the common page shape and accepts `limit` as the page size of page 1 | ADR-217 |
| 8 | UC-204 says "Manage users: lead", authorization matrix says any authenticated user reads users | The matrix wins: reads are open to any authenticated user, writes are lead only | ADR-217 |
| 9 | Task 1 `Project.dueDate` is required; Task 2 makes it optional | Task 2 follows its own pack (optional, nullable). Generated Task 1 types will need `dueDate` nullable: reported by the compatibility check | ADR-218 |
| 10 | Section 9 asks for `Content-Security-Policy: default-src 'none'` on API responses, which would break Swagger UI in development | Applied to API responses; the docs pages get a policy that lets Swagger UI load, and are off in production | ADR-219 |
| 11 | `Retry-After` and body-limit behaviour with chunked bodies unspecified | Limit enforced on Content-Length and on the streamed body | ADR-219 |
| 12 | Task 1 pack was attached to the prompt only as text; Task 2 pack section 1 refers to it | Copy kept in `docs/standards/` | none |
