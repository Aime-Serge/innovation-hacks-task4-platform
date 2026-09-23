# Contributing

This is the Task 4 capstone of the Innovation Hacks Full Stack Development
Internship: a monorepo with `frontend/` (Next.js, ported from Task 1),
`backend/` (FastAPI + PostgreSQL, ported from Task 3, plus an AI package),
and `docs/` (standards packs, ADRs, runbooks). It is primarily a
single-author submission; this file exists so a reviewer or a future
contributor has a real path in, and so the standards already enforced by the
gate are written down in one place.

## Before you start

Read, in order:

1. Root `README.md` — architecture, environment variables, how to run it.
2. `docs/standards/task4-standards-pack.md` and, because this repository is
   built to the minimal profile extension, `docs/standards/minimal-profile-pack.md`.
3. `docs/adr/README.md` — the architecture decisions already made, and why.
4. `docs/blockers.md` — known open items; check you are not duplicating one.

## Local setup

```bash
make env          # writes .env with random local secrets (git-ignored)
make up           # database, migrations, API on :8000, site on :3000
```

Requires Docker, Node 22, Python 3.12 with `uv`, and `make`. See the root
`README.md` for the full walkthrough, including the fake AI provider used
locally (no API key needed).

## Making a change

- Keep `frontend/` and `backend/` changes in separate commits where
  practical; each has its own lint/type/test toolchain.
- Follow the existing commit style: `type(scope): summary`
  (`feat(web): ...`, `fix(api): ...`, `docs: ...`, `chore(web): ...`), as
  seen in `git log`.
- If a change contradicts an existing ADR, add a new ADR rather than editing
  the old one — see the numbering ranges explained in `docs/adr/README.md`.
  Do not renumber or delete an existing ADR.
- If a change alters the behavior of an existing test or rule, record it in
  `docs/supersession-log.md` with the old assertion, the new one, and why —
  the same convention already used throughout that file.

## The gate

Before opening a pull request, run `make gate` (see the "The gate" section
of the root `README.md` for exactly what it runs: type checks, lint, unit
and component tests, the browser journey, accessibility, security checks,
and the documentation/guide-compliance checks). CI runs the same checks via
`.github/workflows/ci.yml`.

## Pull requests

- Use the PR template (`.github/PULL_REQUEST_TEMPLATE.md`); it asks for the
  requirement ID(s) the change serves, from `docs/standards/task4-standards-pack.md`
  or `docs/standards/minimal-profile-pack.md`.
- Reviewers are assigned by `.github/CODEOWNERS`.
- Do not commit secrets. `backend/.env.example` and `frontend/.env.example`
  are the templates; real values are never committed. gitleaks runs as part
  of `make security-full`.

## Reporting a security issue

See `SECURITY.md` — do not open a public issue for a suspected
vulnerability.

## Code of conduct

Be respectful and constructive in issues, reviews and commit messages. No
harassment, no personal attacks. This project has no separate
`CODE_OF_CONDUCT.md` yet; treat this section as the baseline until one
exists.
