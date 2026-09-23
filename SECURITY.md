# Security Policy

This is the Task 4 capstone of the Innovation Hacks Full Stack Development
Internship: an educational monorepo (`frontend/` = Task 1 port, `backend/` =
Task 3 port plus an AI package). It is not a production service with paying
users, but the practices below are followed as if it were.

## Reporting a vulnerability

Please do not open a public GitHub issue for a suspected vulnerability.

Instead, email <set-me> (or use GitHub's private "Report a vulnerability"
flow under the Security tab, if enabled on this repository) with:

- A description of the issue and its potential impact.
- Steps to reproduce, or a proof of concept.
- The commit hash or tag you tested against.

You should receive an acknowledgement within a few days. This is a
single-maintainer student project, so response times are best-effort, not a
contractual SLA.

## Supported versions

There is no formal release train yet (see `CHANGELOG.md` — no tag has been
cut for the Task 4 platform itself; `task-3-baseline` marks an earlier,
narrower milestone). Only the `main` branch is maintained; report issues
against the latest commit on `main`.

## Known, already-assessed findings

- **gitleaks (full history, all branches) found one historical finding**: a
  hardcoded string `"evaluation-pass-1"` used as a password for an
  in-memory-only, throwaway evaluator account in
  `backend/scripts/ai_eval.py`, at an old commit (`fc2179d`). It is already
  fixed on `main` (the script now uses `secrets.token_urlsafe`). This was
  assessed as not a real credential exposure: the value never left process
  memory and there is nothing external to rotate. Git history was
  deliberately not rewritten for this repository — see
  `docs/security/gitleaks-finding.md` for the full record and the human
  decision that would be needed to purge it anyway.
- Two gitleaks findings are tracked as reviewed false positives in
  `.gitleaksignore` (a key-shaped test fixture in
  `backend/tests/unit/test_docs_check.py`, and a loopback readiness-probe
  URL in `backend/scripts/run_load_sql.sh`); neither is a credential.

## Scope notes

- Secrets (`JWT_SECRET` / `SECRET_KEY`, database passwords, `LLM_API_KEY`)
  are environment-only and are never committed; see `backend/.env.example`
  and `frontend/.env.example`.
- The AI pipeline only ever suggests; it has no tools and writes nothing but
  a usage row. See the "API and AI design and limits" section of the root
  `README.md`.
- Dependency scanning: `npm audit` (frontend) and `pip-audit` (backend) run
  as part of `make gate` / `make security-full`; Dependabot is configured in
  `.github/dependabot.yml` for both package ecosystems.
