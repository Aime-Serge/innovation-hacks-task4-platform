#!/usr/bin/env bash
# Create .env from .env.example with freshly generated secrets. Refuses to overwrite an existing .env.
set -euo pipefail
[ -e .env ] && { echo ".env already exists; leaving it alone." >&2; exit 0; }
rand() { python3 -c 'import secrets; print(secrets.token_urlsafe(24))'; }
APP_PW="$(rand)"; MIG_PW="$(rand)"; RO_PW="$(rand)"; ADMIN_PW="$(rand)"; KEY="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"
umask 077
sed -e "s|^SECRET_KEY=.*|SECRET_KEY=$KEY|" \
    -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$ADMIN_PW|" \
    -e "s|^APP_DB_PASSWORD=.*|APP_DB_PASSWORD=$APP_PW|" \
    -e "s|^MIGRATOR_DB_PASSWORD=.*|MIGRATOR_DB_PASSWORD=$MIG_PW|" \
    -e "s|^READONLY_DB_PASSWORD=.*|READONLY_DB_PASSWORD=$RO_PW|" \
    -e "s|^DATABASE_URL=.*|DATABASE_URL=postgresql+asyncpg://ih_app:$APP_PW@127.0.0.1:5432/ih_platform|" \
    -e "s|^MIGRATION_DATABASE_URL=.*|MIGRATION_DATABASE_URL=postgresql+asyncpg://ih_migrator:$MIG_PW@127.0.0.1:5432/ih_platform|" \
    .env.example > .env
echo "Wrote .env with generated secrets (it is ignored by Git)."
