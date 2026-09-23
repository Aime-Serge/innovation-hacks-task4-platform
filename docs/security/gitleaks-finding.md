# gitleaks finding — permanent record

This is the permanent record of the one real gitleaks finding in this
repository's history, produced by a full-history, all-branches gitleaks run
performed by the orchestrating session (not re-run as part of this
documentation pass).

## What was found

- **File:** `backend/scripts/ai_eval.py`
- **Commit:** `fc2179d` (historical; superseded on `main`)
- **What:** a hardcoded string literal `"evaluation-pass-1"` used as the
  password for an in-memory-only, throwaway evaluator account created by
  the AI evaluation script.

## Why this is not treated as a live credential exposure

- The account it authenticated was created in memory for the duration of a
  single evaluation run and was never persisted to a real database used
  outside that run.
- The value never left process memory: it was not sent to an external
  service, logged, or exposed over a network boundary in a way that a third
  party could observe or replay.
- There is nothing external to rotate. It is not a database password, API
  key, JWT signing secret, or any credential that grants access to a
  running system, a cloud account, or user data.

Based on this, the finding was assessed as **not a real credential
exposure**.

## Current state

- Already fixed on `main`: `backend/scripts/ai_eval.py` now generates the
  evaluator account's password with `secrets.token_urlsafe(...)` instead of
  a hardcoded string.
- Git history was **deliberately not rewritten** to remove commit `fc2179d`
  or the string from earlier commits. This was a considered decision, not
  an oversight: rewriting history (e.g. `git filter-repo`, force-pushing a
  rewritten `main`) is disruptive to any existing clones, branches, and PR
  references, and carries its own risk of mistakes. Given that the string
  was assessed as not a live secret, the orchestrating session judged that
  risk not worth taking unilaterally.

## If the human maintainer wants it purged anyway

Rewriting history is a human call this pass does not make. If the
maintainer decides the string should be removed from history regardless
(for example, for a clean public-facing history, or out of caution beyond
the technical risk assessment above), the decision needed is:

1. Confirm no other clone, fork, or open PR depends on the current commit
   graph reachable from `fc2179d` onward (a rewrite changes every
   descendant commit's hash).
2. Choose a rewrite tool (`git filter-repo` is the currently recommended
   approach over the older `git filter-branch` / BFG for most cases) and
   run it against a fresh clone, never the working copy in active use.
3. Force-push the rewritten history and have every collaborator re-clone
   (not just `pull`/`rebase`) afterward.
4. Re-run gitleaks against the rewritten history to confirm the string is
   gone from every reachable commit, not just `main`.

This closeout pass did not perform any of the above; it only records the
finding and the assessment.

## Separately tracked false positives

`.gitleaksignore` at the repository root tracks two additional gitleaks
matches that were reviewed and are **not** credentials:

| Fingerprint | File | Rule | Why it is not a credential |
|---|---|---|---|
| `689468391dddd006c6e495b84b0e38a4ebc91d0c:backend/tests/unit/test_docs_check.py:gcp-api-key:89` | `backend/tests/unit/test_docs_check.py` | `gcp-api-key` | A fake, key-shaped string in a test that proves the docs-check tooling catches key-shaped text; not a real key. |
| `93eb0047efec7dd4bd0fc7889496da48236e3004:backend/scripts/run_load_sql.sh:curl-auth-user:15` | `backend/scripts/run_load_sql.sh` | `curl-auth-user` | A loopback readiness probe in the imported Task 3 load script; not an external credential. |
