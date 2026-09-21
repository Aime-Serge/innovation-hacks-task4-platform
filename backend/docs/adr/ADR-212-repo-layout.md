# ADR-212: the project lives at the repository root, not in `backend/`

**Status:** Accepted.

The pack's layout section assumes a monorepo with a `backend/` directory. This repository is the standalone Task 2 repository, so the project (`app/`, `tests/`, `pyproject.toml`) sits at the root, as Task 1's did. Every make target and CI step runs from the root. If Task 4 folds this into a monorepo, the move is a `git mv` plus a working-directory change in `ci.yml`; no code path depends on the location.
