# ADR-213: Python 3.12, not the deployed 3.14

**Status:** Accepted.

The pack requires Python 3.12. The earlier Render deployment pinned 3.14. The project now declares `requires-python = ">=3.12,<3.13"`, uv installs 3.12 locally and in CI, the Dockerfile uses `python:3.12-slim`, and Render builds the Docker image, so the runtime is the one the tests ran on. Nothing in the code needs a newer interpreter. It does use 3.12 syntax (PEP 695 generics such as `Page[T]`), so 3.11 would not run it.
