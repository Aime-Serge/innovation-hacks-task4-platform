# Handoff Artifact: AI Integration Engineer → Security Reviewer, QA Engineer

Note: this feature was already implemented and committed (`eaaefc4`,
`feat(ai): add AI-assisted task generation with a real fallback`) while
executing the Frontend Engineer role, whose own step 6 (wire the AI UI)
needed the endpoint to exist. This artifact formalizes that work against
this role's checklist rather than redoing it.

## Chosen AI Feature

**AI-assisted task generation** — chosen by the Product Manager over the
other four options (task summarization, AI-generated project
descriptions, AI productivity suggestions, AI-assisted prioritization)
because it's useful even for a brand-new, empty project, unlike the
others which need an existing body of tasks to act on.

## Contract (per the Solutions Architect)

- Acts on: **Project**, not Task — produces candidate tasks, doesn't
  mutate anything itself.
- `POST /projects/{project_id}/ai/generate-tasks`, auth required,
  project-ownership enforced (404 for a project that isn't the caller's).
- Request: `{ instructions?: string (≤1000 chars), count?: int (1-8, default 5) }`
- Response 200 always: `{ source: "ai" | "fallback", tasks: [{ title, description, priority }] }`

## Prompt Template Used

Structured output is forced via Anthropic tool-use (not prompt-engineered
JSON-in-prose), so the model has no opportunity to return unparseable
text:

```
tool: propose_tasks
  input_schema: { tasks: [{ title: string, description: string, priority: "low"|"medium"|"high" }] }
tool_choice: { type: "tool", name: "propose_tasks" }
```

User-message prompt (`app/routers/ai.py`, `_call_anthropic`):

```
Project name: {project_name}
Project description: {project_description or "(none provided)"}
Additional instructions from the user: {instructions or "(none)"}

Propose exactly {count} concrete, actionable tasks that would move this
project forward. Keep titles short and descriptions to 1-2 sentences.
```

Model: `ANTHROPIC_MODEL` env var, default `claude-haiku-4-5-20251001` —
Haiku chosen deliberately for cost/latency on a short structured-output
call; nothing about this feature needs a larger model's reasoning depth.

## Failure-Mode Handling

All three failure tiers are caught **distinctly in code** (so operator
logs say what actually happened) but resolve to the **same user-visible
outcome by design** — a normal 200, `source: "fallback"`, the identical
checklist UI with a neutral notice instead of error styling. This is a
deliberate choice, not a gap: none of "timed out," "rate-limited," or
"the model's response didn't parse" is something the user can act on
differently, so distinguishing them in the UI would be noise, not signal.

| Failure | Where caught | Logged as | User sees |
|---|---|---|---|
| No `ANTHROPIC_API_KEY` configured | `_call_anthropic` early return | (nothing — expected/normal) | Fallback checklist, quiet notice |
| Timeout (20s client timeout) | `except anthropic.APIError` (`APITimeoutError` is a subclass) | `logger.warning` with the exception | Same |
| Rate limit (429) | `except anthropic.APIError` (`RateLimitError` is a subclass) | `logger.warning` with the exception | Same |
| Network/connection error | `except anthropic.APIError`, or bare `except Exception` for anything outside the SDK's hierarchy | `logger.warning`/`logger.exception` | Same |
| Response has no `tool_use` block | explicit check after the call | `logger.warning` | Same |
| `tool_use.input` missing `tasks` or items don't match the schema | `except (KeyError, TypeError, ValueError)` | `logger.warning` | Same |

The one case that does **not** collapse into the fallback: the frontend
failing to reach the backend *at all* (DNS/network failure before any
HTTP response) — that's a genuine `ErrorState` + Retry in
`GenerateTasksPanel`, since it's not the backend choosing to degrade,
it's the backend being unreachable.

## Demoability

Full interaction — click "Generate tasks with AI" → loading skeleton →
editable checklist → "Add N tasks" — is 2 clicks and, on the fallback
path (no key needed for a demo), effectively instant; on the real AI
path, a Haiku tool-forced call typically returns in a few seconds. Well
inside a 60-second demo clip alongside everything else on that screen.

## Verification status

Same caveat as the Backend/Database Engineer handoff: `tests/test_ai.py`
(6 tests, all exercising the fallback path since no API key exists in
this environment) is written and imports cleanly, but hasn't run against
a live Postgres yet — Docker is blocked in this session pending a fresh
terminal on the user's end, or will be exercised at deploy time.

## Arranged Commit List

```
eaaefc4 feat(ai): add AI-assisted task generation with a real fallback
```
