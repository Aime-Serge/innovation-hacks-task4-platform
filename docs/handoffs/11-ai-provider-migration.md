# Handoff: AI Provider Migration — Anthropic → Gemini

Supersedes the provider choice recorded in `01-product-manager.md`,
`03-solutions-architect.md`, `06-ai-integration-engineer.md`,
`07-security-reviewer.md`, and `08-qa-engineer.md` — those describe the
Anthropic implementation as it stood at the time and are left
unedited as an honest record; this doc is the update.

## Why

Anthropic's API has no perpetual free tier — it requires billing set up
to get a working key. Gemini's API has a genuine free tier (rate-limited
but $0, no card required), which matters directly for an internship
project graded without a budget attached: anyone reviewing or re-running
this needs to be able to get a real key with zero cost.

## What changed

- `app/routers/ai.py`: `_call_anthropic` → `_call_gemini`. Anthropic's
  forced tool-use is replaced by Gemini's structured-output mode
  (`response_mime_type="application/json"` + `response_schema`) — same
  property (the model is constrained to emit exactly the expected shape,
  not prose to parse), different mechanism.
- `app/config.py`: `anthropic_api_key`/`anthropic_model` →
  `gemini_api_key`/`gemini_model` (default `gemini-3.6-flash`).
- `requirements.txt`: `anthropic` removed; `google-genai` and its actual
  transitive dependencies added — verified by a **fresh venv install
  from this file alone**, not assumed. That install caught a real
  version conflict (`google-genai` needs `websockets<17`; the pinned
  `17.1` had to drop to `16.1.1`) that would otherwise have only
  surfaced during deployment.
- `tests/test_ai_failure_modes.py`: rewritten against the real
  `google-genai` SDK. Every exception type mocked (`httpx.ConnectTimeout`
  for timeout, `genai_errors.ClientError`/`ServerError` for rate-limit/
  server failures) was **verified against the live API first**, not
  guessed — including deliberately triggering a real 1ms timeout to
  confirm what exception it actually raises. All 7 tests (was 6 — added
  a dedicated server-error case) run without a database and pass.
- `.env.example`, `README.md`, `DEMO_SCRIPT.md`,
  `FINAL_TASK_STATUS_REPORT.md`: `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL` →
  `GEMINI_API_KEY`/`GEMINI_MODEL` throughout.

## Verified live, not just unit-tested

With a real key: a call through the actual production `_call_gemini`
function against the real Gemini API returned a genuinely useful,
well-formed task breakdown for a real project description, in ~8.5
seconds end-to-end. The request timeout was bumped from 20s to 30s after
one real call in this environment took closer to that — better to have
headroom than a false-positive fallback under normal latency.

The API key used for this verification was pasted directly into chat by
the user rather than placed in a local `.env` file — it was written only
to a gitignored `backend/.env`, never echoed back, never committed, and
the user was advised to rotate/regenerate it in Google's console given
it briefly existed in the conversation transcript.

## Test suite status

90 tests total (was 89 — +1 for the new server-error case), all
collecting cleanly. The 7 AI failure-mode tests run without a database
and passed for real in this session, same as before the migration; the
other 83 (everything DB-backed) still haven't executed end-to-end
locally — unchanged limitation, documented in the Backend/Database
Engineer and QA Engineer handoffs, to be closed at deployment.
