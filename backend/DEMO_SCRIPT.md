# Demo script: Task 2 API (about 4 minutes)

Record the screen with the terminal on the left and the browser on the right. Say the line in
quotes, then do the action.

## Set up before recording

```bash
uv sync --frozen
export SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')
SEED_PASSWORD='Demo-Password-123' SEED_PROFILE=default uv run uvicorn app.main:create_app --factory
```

Open http://127.0.0.1:8000/docs in the browser. The demo password lives only in your shell.

## 1. The contract (40 s)

"This is the Task 2 API, built to an engineering standards pack. The interactive docs are generated
from the code, and a test fails the build if `docs/openapi.json` drifts from them."

- Scroll the operation list: Authentication, Users, Projects, Tasks, Dashboard, Health.
- Open **POST /api/v1/tasks**. Point at the request example, the response example and the list of
  documented errors (400, 401, 403, 409, 413, 415, 422, 500).

## 2. Authentication (40 s)

"No default credentials. Log in as the seeded lead."

- **POST /api/v1/auth/login** with `amara.diallo@example.com` and the demo password. Copy the token,
  click **Authorize**, paste it.
- Try a wrong password, then an unknown email. "Same 401, same message, so it cannot be used to
  find out which accounts exist."
- **GET /api/v1/auth/me** shows the lead.

## 3. A task through its workflow (75 s)

"Business rules are enforced on the server, not the client."

- **POST /api/v1/projects**, then **POST /api/v1/tasks**. Point at `201` and the `Location` header.
- **PATCH /api/v1/tasks/{taskId}/status** with `done` straight from `todo`. Show the `409
  INVALID_STATUS_TRANSITION` and the `allowedStatuses` detail.
- Move it `in_progress`, `in_review`, `done`. Show `completedAt` appear. Move it back to
  `in_progress` and show `completedAt` clear.
- **GET /api/v1/projects/{projectId}**: the progress numbers changed.

## 4. Permissions and validation (45 s)

- Register a new account, log in as it, and try **DELETE /api/v1/users/{userId}**. `403 FORBIDDEN`.
- **POST /api/v1/projects** with `{"name": "  ", "ownerId": "x"}`. `422` with a field list, and
  "clients can never set the owner".
- **GET /api/v1/tasks?pageSize=500**. `422`, and the error shows `requestId`.

## 5. The gate (45 s)

"Everything I just showed is a test."

In the terminal run `make test` and show the coverage line and the endpoint-coverage line, then
`make layers` ("the architecture rules are enforced by a tool"). Mention Schemathesis, Newman, Locust.

## Say honestly at the end (15 s)

"State is in memory and resets on restart, and the rate limiter is per process. Task 3 adds the
database."

## Before you upload

- [ ] The recording shows no real password or token (blur the Authorize dialog if in doubt)
- [ ] The README has the demo link, and `docs/openapi.json` is committed
