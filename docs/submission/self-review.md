# Self-review against the guide's rubric (guide section 10)

Weights are the guide's. The submission standard's own sheet is not in the repository (GAP-09, ADR-616), so this uses the guide's eight criteria directly. **No scores are given**: a number would be invented before the gate has been run on the final tree and before anyone else has judged the work. Results are stated in words with evidence; "Unfinished" marks what is not done.

| Criterion | Weight | Honest result | Evidence | Unfinished |
|---|---|---|---|---|
| Functionality | 25% | Tasks 1 to 4 features exist, including AI generation. The profile, registration and people-picker work of feat/minimal-profile is in progress on this branch. | `docs/guide-compliance.md` (rows marked Partial and Pass), `docs/baseline-final.md` | Profile features not yet verified end to end; live AI evaluation not yet run (`docs/ai-evaluation.md`) |
| Code Quality | 20% | Layered code with lint, types and import boundaries; tests at unit, API, database and browser level. The baseline had one failing backend test and a Prettier failure. | `docs/baseline-final.md`, `docs/blockers.md`, `frontend/tests/unit/security.test.ts` | Baseline failures; a green `make gate` is not yet recorded |
| UI / UX | 15% | Responsive layout, dark and light themes, designed loading, empty and error states, keyboard navigation and axe tests exist for Task 1 and 4 screens. The new screens are in progress. | `frontend/tests/e2e/responsive.spec.ts`, `frontend/tests/e2e/states.spec.ts`, `frontend/tests/live/a11y.spec.ts` | New profile, people and settings screens at three viewports; Task 4 screenshots not captured |
| Technical Implementation | 15% | Server-layer cookies, rotating refresh tokens, visibility scoping, database constraints, an AI pipeline that only suggests, quotas. | `docs/adr/`, `backend/tests/auth/test_sessions.py`, `backend/tests/db/test_integrity.py` | Migration 0008 and its tests in progress; the first-load JavaScript budget is exceeded (B-401 in `docs/blockers.md`) |
| Documentation | 10% | README with features, stack, architecture, install, environment table and limitations; ADRs; runbook; how-it-works with review questions. | `README.md`, `docs/deploy-runbook.md`, `docs/how-it-works.md` | The author's answers to the review questions are empty; a clean-clone install test was not run |
| GitHub Repository Quality | 5% | Logical commits, ADRs, no secrets in tracked files by design; gitleaks is part of `make guide-check`. | `git log`, `.gitignore`, `.gitleaksignore` | No release or tag for this work; a gitleaks run on the final tree is not recorded |
| Demo & Presentation | 5% | A timed four-segment script exists. | `docs/submission/demo-script.md` | Video not recorded; length and link unknown |
| Innovation / Additional Features | 5% | Three AI features that only suggest, prompt minimisation, quotas and a kill switch, and a machine-checked compliance matrix. | `docs/ai-evaluation.md`, `docs/guide-compliance.md` | Live evaluation of the AI not yet run |

Weights total 100%.

## Before submitting

1. Run `make gate` and record the result in `docs/reports/`.
2. Update the statuses in `docs/guide-compliance.md` from the running application.
3. Fill in the Author's answers in `docs/how-it-works.md`.
4. Record the video, publish the post, and fill the `<pending>` links in the README.
