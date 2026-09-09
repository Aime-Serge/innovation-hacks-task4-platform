# Backend — AI-Powered Project & Task Management Platform

FastAPI + PostgreSQL backend for Task 4 (capstone) of the Innovation
Hacks Full Stack Development Internship. Full setup, environment
variables, and feature documentation live in the
[repo root README](../README.md) — this file is a quick reference for
working inside `backend/` specifically.

## Quick reference

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then fill in DATABASE_URL, SECRET_KEY, etc.
docker compose up -d   # local Postgres
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

- Interactive API docs: `http://localhost:8000/docs`
- Tests: `pytest` (89 tests — needs the database migrated)
- Migrations: `alembic revision --autogenerate -m "..."` then review
  before committing — this project has never used autogenerate blindly,
  every migration in `migrations/versions/` is hand-reviewed

See [`docs/handoffs/04-backend-database-engineer.md`](../docs/handoffs/04-backend-database-engineer.md)
and [`docs/handoffs/06-ai-integration-engineer.md`](../docs/handoffs/06-ai-integration-engineer.md)
for the design decisions behind auth, the schema, and the AI endpoint.
