# Root gate (pack section 11). Targets are added as the code they check is written; nothing here
# is a stub that always passes.
SHELL := /bin/bash
.PHONY: env up down gate gate-api gate-web

env:  ## write a local .env with random secrets (never overwrites an existing one)
	@test -f .env && echo ".env exists; left as is" || { python3 -c "import secrets,re;t=open('.env.example').read();print(re.sub(r'<set-me>',lambda m:secrets.token_urlsafe(24),t),end='')" > .env && chmod 600 .env && echo "wrote .env"; }

up:  ## full local stack: database, migration step, API
	docker compose up -d --build

down:
	docker compose down

gate-api:  ## Task 2 and Task 3 gates (the API repository's own gate)
	$(MAKE) -C backend gate

gate-web:  ## Task 1 frontend gate
	cd frontend && npm run gate

gate: gate-api gate-web
