# Closeout summary

Real, verifiable facts gathered during the `chore/closeout` documentation
pass for this repository. No gate was re-run to produce this file; where a
number depends on a gate run, it is cited from an existing doc rather than
re-measured here.

## Repository facts (verified by `git`)

- Current branch under closeout: `chore/closeout`, branched off `main`.
- `main` commit count: 139 (`git rev-list --count main`).
- Tags: `task-3-baseline` only (`git tag`), pointing at
  `0d92ffca770fdba57636be848c7ee2c29e8e272a`
  ("feat(web): import the Task 1 frontend as frontend/ (NFR-423)"),
  dated 2026-09-21 06:23:08 +0200. No tag exists yet for the Task 4
  platform itself -- see the tagging recommendation below.
- Contributors (`git shortlog -sn --all`): 133 commits as `Aime-Serge`, 7 as
  `Aime Serge UKOBIZABA` (same person, two author identities).
- `docs/reports/` did not exist before this pass; this file is the first
  entry in it. There was no prior gate output in that directory to reuse.

## Documentation inventory touched by this pass

- ADRs: `docs/adr/` holds 38 ADR files (`ls docs/adr/*.md` minus
  `README.md`) -- ADR-401 to ADR-417 (17), ADR-425 and ADR-426 (2, filed in
  this directory even though several numbers in the 418-424 range live in
  `backend/docs/adr/` per the existing index), and ADR-601 to ADR-619 (19,
  minimal profile). `docs/adr/README.md`'s index table was missing
  ADR-617, ADR-618 and ADR-619; those three rows were added using each
  file's own first heading as the title. No ADR file was renamed,
  renumbered or deleted.
- Screenshots: 33 real PNG files across three directories (18 in
  `docs/screenshots/task-4/`, 3 in `backend/docs/screenshots/`, 12 in
  `frontend/docs/screenshots/`). Full inventory:
  `docs/screenshots-inventory.md` (new, this pass).
- `CHANGELOG.md` already tracked the unreleased `v1.1.0` minimal-profile
  work in detail; a dated entry for the `task-3-baseline` tag was added
  since the file previously stated "No tag has been created" without
  acknowledging the one tag that does exist.
- Root `README.md` was read in full and audited against the 8-item
  checklist. It is already comprehensive: 3-command local setup, a real
  architecture diagram, a feature table, and an environment-variable table
  that matches `backend/.env.example` and `frontend/.env.example`
  (spot-checked field by field), with `<pending>` placeholders for the demo
  link and submission links rather than invented ones. No edit was made to
  it in this pass; the tech-stack section already defers to
  `frontend/package.json` / `backend/pyproject.toml` rather than restating
  versions inline, and the feature table maps to guide requirements in
  prose rather than to bare `FR-4xx` IDs -- a narrow gap, left as-is rather
  than risk an inaccurate remap under time pressure.

## Known real versions (for reference; not written into README.md)

- Frontend (`frontend/package.json`): Next.js 16.3.4, React 19.2.8,
  `@tanstack/react-query` 5.103.1, `@types/node` 22.20.1,
  `@playwright/test` 1.63.0.
- Backend (`backend/pyproject.toml`): Python `>=3.12,<3.13`, FastAPI,
  SQLAlchemy `>=2.0` (async), Alembic `>=1.20.0`, asyncpg `>=0.31.0`.

## Security

- gitleaks was run for real (full history, all branches) by the
  orchestrating session, outside this closeout pass. One finding, already
  fixed on `main`; history was deliberately not rewritten. Full record:
  `docs/security/gitleaks-finding.md` (new, this pass).
- `.gitleaksignore` separately tracks two reviewed false positives (a
  key-shaped test fixture and a loopback readiness-probe URL); neither is a
  credential.

## Recommendation for the human maintainer

- Consider tagging `main` (after merging this closeout branch) as
  `v1.0.0` once `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md` and the
  `.github/` additions from this pass are reviewed. This document does not
  create that tag (no `git tag` / `git push` was run, per instructions).
- B-401 (first-load JS budget exceeded, `docs/blockers.md`) remains the one
  concrete open item blocking a clean "gate green" claim in any future
  release notes; it was not touched by this docs-only pass.
