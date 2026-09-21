"""`python -m app.seed --profile <name> [--reset --yes]`: load a profile into the SQL database.

`--reset` clears every table first and needs `--yes`. Both are refused when APP_ENV=production.
With the memory backend there is nothing to fill from a separate process; start the server with
SEED_PROFILE instead.
"""

import argparse
import asyncio
import os
import secrets
import sys

from app.container import build_container
from app.core.config import load_settings
from app.repositories.sql.maintenance import clear_all
from app.seed import seed


async def main(profile: str, reset: bool, confirmed: bool) -> int:
    settings = load_settings()
    if settings.is_production:
        print("Refusing to seed: APP_ENV=production.", file=sys.stderr)
        return 1
    if settings.storage_backend != "sql":
        print("Set STORAGE_BACKEND=sql and DATABASE_URL to seed a database.", file=sys.stderr)
        return 1
    if reset and not confirmed:
        print("--reset deletes every row. Add --yes to confirm.", file=sys.stderr)
        return 1
    container = build_container(settings)
    try:
        if reset and container.database is not None:
            await clear_all(container.database)
        given = os.environ.get("SEED_PASSWORD") or (
            settings.seed_password.get_secret_value() if settings.seed_password else None
        )
        password = given or secrets.token_urlsafe(16)
        result = await seed(container, profile, password)
    finally:
        await container.close()
    print(
        f"Seeded profile '{profile}': {result.users} users, {result.projects} projects, "
        f"{result.tasks} tasks, {result.activity} activity items."
    )
    if not given:
        print(f"One-time password for every seeded account: {password}")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Load seed data into the database.")
    parser.add_argument("--profile", choices=["default", "empty", "large", "xl"], default="default")
    parser.add_argument("--reset", action="store_true", help="delete existing data first")
    parser.add_argument("--yes", action="store_true", help="confirm --reset")
    args = parser.parse_args()
    sys.exit(asyncio.run(main(args.profile, args.reset, args.yes)))
