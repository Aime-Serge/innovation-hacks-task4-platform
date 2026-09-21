# Every gate step is a target; `make gate` runs them all and stops at the first failure.
UV      ?= uv
RUN     := $(UV) run --frozen
PORT    ?= 8123
export PYTHONPATH := .

COMPOSE  := docker compose -f database/docker-compose.yml --env-file .env
# Run a command with .env loaded (the file holds secrets and is never committed).
WITHENV  := set -a && . ./.env && set +a &&

.PHONY: postman-sql env fast db-up db-down db-migrate db-check db-roundtrip test-sql test-integrity \
        test-concurrency db-security db-perf db-docs db-docs-check db-backup db-restore-test \
        db-gate run install dev lint format typecheck layers test coverage spec-check export-spec spec-diff \
        contract security secrets postman load docker gate

install:
	$(UV) sync --frozen

dev:
	$(RUN) uvicorn app.main:create_app --factory --reload --port 8000

lint:
	$(RUN) ruff check .
	$(RUN) ruff format --check .

format:
	$(RUN) ruff check --fix .
	$(RUN) ruff format .

typecheck:
	$(RUN) mypy --strict app scripts tests

layers:
	$(RUN) lint-imports

test:
	$(RUN) pytest --cov=app --cov-report=term-missing --cov-report=xml

export-spec:
	$(RUN) python scripts/export_openapi.py

spec-check:
	$(RUN) python scripts/export_openapi.py --check

spec-diff:
	$(RUN) python scripts/openapi_diff.py

contract:
	$(RUN) pytest tests/contract -m "contract" -q

security:
	$(RUN) bandit -q -r app -c pyproject.toml
	$(UV) export --frozen --no-dev --no-emit-project -o /tmp/devdash-requirements.txt >/dev/null
	$(RUN) pip-audit -r /tmp/devdash-requirements.txt --no-deps --disable-pip

secrets:
	gitleaks detect --no-banner --redact

postman:
	$(RUN) python scripts/build_postman.py
	./scripts/run_newman.sh $(PORT)

load:
	./scripts/run_load.sh $(PORT)

docker:
	docker build -t devdash-api:local .

# --- Task 3: the data layer -------------------------------------------------------------------
env:
	./scripts/make_env.sh

fast: lint typecheck layers
	$(RUN) pytest -q --no-cov -m "not slow and not sql" tests

db-up:
	@test -f .env || { echo "Run: make env   (or copy .env.example to .env and set the passwords)"; exit 1; }
	$(COMPOSE) up -d --wait db

db-down:
	$(COMPOSE) down

db-migrate:
	$(WITHENV) $(RUN) alembic upgrade head

db-check:
	$(WITHENV) $(RUN) alembic check
	$(RUN) pytest -q --no-cov tests/db/test_migrations.py -k "naming or alembic_check or types"

db-roundtrip:
	$(RUN) pytest -q --no-cov tests/db/test_migrations.py -k "tc370 or tc371"

test-sql:
	$(RUN) pytest -q --no-cov --backend sql tests --deselect tests/contract/test_schemathesis.py
	$(RUN) pytest -q --no-cov --backend sql tests/contract/test_schemathesis.py

test-integrity:
	$(RUN) pytest -q --no-cov tests/db/test_integrity.py tests/db/test_queries.py

test-concurrency:
	$(RUN) pytest -q --no-cov tests/db/test_transactions.py tests/db/test_errors_and_resilience.py

db-security:
	$(RUN) pytest -q --no-cov tests/db/test_security.py tests/security
	$(RUN) bandit -q -r app -c pyproject.toml
	docker run --rm -v "$(CURDIR):/repo" zricethezav/gitleaks:latest detect --source /repo --no-banner --redact

db-perf:
	$(RUN) pytest -q --no-cov tests/db/test_performance.py
	$(WITHENV) STORAGE_BACKEND=sql ./scripts/run_load_sql.sh $(PORT)

postman-sql:
	$(WITHENV) ./scripts/run_newman_sql.sh $(PORT)

db-docs:
	$(WITHENV) $(RUN) python scripts/generate_db_docs.py

db-docs-check:
	$(WITHENV) $(RUN) python scripts/generate_db_docs.py --check

db-backup:
	$(WITHENV) BACKUP_DATABASE_URL="$$(./scripts/libpq_url.sh "$$MIGRATION_DATABASE_URL")" ./database/scripts/backup.sh

db-restore-test:
	$(WITHENV) ./scripts/restore_test.sh

run:
	$(WITHENV) $(RUN) uvicorn app.main:create_app --factory --port 8000

db-gate: db-up db-migrate db-check db-roundtrip test-sql postman-sql test-integrity test-concurrency db-security db-perf db-docs-check db-restore-test

gate: lint typecheck layers test spec-check spec-diff contract security postman load db-gate
	@echo "GATE PASSED"
