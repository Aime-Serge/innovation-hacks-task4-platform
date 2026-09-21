# ADR-319: the rebuild is on `task/3-standards-pack`

**Status:** Accepted.

The pack names the branch `task/3-database`. That branch already exists on GitHub from the first implementation of Task 3 (a different design, deployed on Render). Rewriting it would destroy that history, so the rebuild lives on `task/3-standards-pack` and is merged to `main` by pull request. The tag `task-3-submission` goes on the merged commit.
