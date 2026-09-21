# ADR-014: the project sits at the repository root

**Status:** Accepted. Deviation from section 12.

Section 12 describes a monorepo with `frontend/`. This repository is the Task 1 repository on its own, published to its own GitHub project, and its history and deployment already point at the root. `src/`, `tests/` and `docs/` follow the Pack's structure inside it. Moving into `frontend/` when the four tasks are combined is a directory move and a path change in `package.json`, CI and Vercel settings.
