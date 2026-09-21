# The Task 4 Standards Gate (pack section 11, part A). Every target runs a real command: nothing
# here is a stub that always passes. Targets that need the live URLs say so and refuse to guess.
SHELL := /bin/bash
UV    := cd backend && uv run --frozen
WEB   := cd frontend &&
.PHONY: env up down gate gate-api gate-web test-auth test-ai test-web e2e-local security-full \
        deploy-check docs-check smoke e2e-live db-provision db-migrate-prod ai-eval demo-data

env:  ## write a local .env with random secrets (never overwrites an existing one)
	@test -f .env && echo ".env exists; left as is" || { python3 -c "import secrets,re;t=open('.env.example').read();print(re.sub(r'<set-me>',lambda m:secrets.token_urlsafe(24),t),end='')" > .env && chmod 600 .env && echo "wrote .env"; }

up:  ## full local stack: database, migration step, API, site
	docker compose up -d --build

down:
	docker compose down

gate-api:  ## Task 2 and Task 3 gates (the API repository's own gate)
	$(MAKE) -C backend gate

gate-web:  ## Task 1 frontend gate
	cd frontend && npm run gate

# Task 2 and Task 3 gates first (their recorded supersessions are in docs/supersession-log.md), then:
gate: gate-api gate-web test-auth test-ai test-web e2e-local security-full deploy-check docs-check

test-auth:  ## sessions, refresh rotation, reuse detection, the visibility matrix (memory and PostgreSQL)
	$(UV) pytest -q --no-cov tests/auth tests/security/test_isolation.py tests/security/test_authorization_matrix.py
	$(UV) pytest -q --no-cov --backend sql tests/auth tests/security/test_isolation.py

test-ai:  ## fake-provider AI suites, the 20 adversarial fixtures, quotas, prompt minimisation
	$(UV) pytest -q --no-cov tests/ai
	$(UV) pytest -q --no-cov --backend sql tests/ai

test-web:  ## types from openapi.json, unit and component tests, the server layer, adapter parity
	$(WEB) npm run check:api && npm run typecheck && npm run lint && npm run test

e2e-local:  ## Playwright on the compose stack: journey, axe, fault injection, at 3 viewports
	RATE_LIMIT_ATTEMPTS=200 docker compose up -d --build
	@for i in $$(seq 1 60); do curl -fs localhost:8000/readyz >/dev/null && curl -fs -o /dev/null localhost:3000/login && break; sleep 2; done
	$(WEB) LIVE_URL=http://localhost:3000 npx playwright test tests/live/journey.spec.ts tests/live/a11y.spec.ts --project=live --workers=1
	./scripts/e2e-faults.sh

security-full:  ## gitleaks (files and history), the built bundle, npm audit, pip-audit, headers and cookies
	$(MAKE) -C backend security
	docker run --rm -v "$(CURDIR):/repo" zricethezav/gitleaks:latest detect --source /repo --no-banner --redact
	$(WEB) npm audit --audit-level=high && NEXT_PUBLIC_DATA_SOURCE=http npm run build && npm run scan:bundle
	$(WEB) npx vitest run --configLoader runner tests/unit/security.test.ts tests/unit/bff.test.ts tests/unit/session-lib.test.ts tests/unit/proxy.test.ts
	$(UV) pytest -q --no-cov tests/security tests/unit/test_settings_task4.py

deploy-check:  ## render.yaml, Vercel settings and headers, env tables against Settings, additive migrations, the previous release on the new schema
	$(UV) python ../scripts/deploy_check.py
	$(UV) pytest -q --no-cov tests/unit/test_deploy_check.py
	./scripts/compat-check.sh

docs-check:  ## README sections, env tables, ADR index, the supersession log, the runbook
	$(UV) pytest -q --no-cov tests/unit/test_documentation.py
	$(UV) python ../scripts/docs_check.py

# ---- after each deploy (need your live URLs) ---------------------------------------------------
smoke:  ## the journey and timings against the live site: SITE_URL=https://...
	@test -n "$$SITE_URL" || { echo "Set SITE_URL to the deployed frontend address"; exit 2; }
	./scripts/smoke.sh

e2e-live:  ## Playwright journey and axe on the live site at 3 viewports: SITE_URL=https://...
	@test -n "$$SITE_URL" || { echo "Set SITE_URL to the deployed frontend address"; exit 2; }
	$(WEB) LIVE_URL="$$SITE_URL" npx playwright test tests/live/journey.spec.ts tests/live/a11y.spec.ts --project=live --workers=1

# ---- operator steps (secrets come from your shell, never from a file) ----------------------------
db-provision:
	./scripts/db-provision.sh

db-migrate-prod:
	./scripts/db-migrate-prod.sh

# ---- before submission (needs your provider key) --------------------------------------------------
ai-eval:  ## live provider evaluation; writes docs/ai-evaluation.md
	@test -n "$$LLM_API_KEY" || { echo "Set LLM_API_KEY and LLM_MODEL in your shell to run the live evaluation"; exit 2; }
	$(UV) python -m scripts.ai_eval

demo-data:  ## realistic projects and tasks for an account, through the public API: SITE_URL=... DEMO_EMAIL=... DEMO_PASSWORD=...
	./scripts/demo-data.sh
