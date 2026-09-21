"""Alembic environment: async, runs as the migration role, URL only from the environment."""

import asyncio
import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import Connection, pool
from sqlalchemy.ext.asyncio import create_async_engine

from app.repositories.sql.models import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata = Base.metadata


def _url() -> str:
    url = os.environ.get("MIGRATION_DATABASE_URL")
    if not url:
        raise SystemExit("Invalid configuration. MIGRATION_DATABASE_URL: Field required")
    return url


def _configure(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
    )


def _migrate(connection: Connection) -> None:
    _configure(connection)
    with context.begin_transaction():
        context.run_migrations()


async def _run_async() -> None:
    engine = create_async_engine(_url(), poolclass=pool.NullPool)
    async with engine.connect() as connection:
        await connection.run_sync(_migrate)
    await engine.dispose()


def run_migrations_online() -> None:
    # Tests hand in a connection they already hold; otherwise connect from the environment.
    supplied = config.attributes.get("connection")
    if supplied is not None:
        _migrate(supplied)
    else:
        asyncio.run(_run_async())


if context.is_offline_mode():
    raise SystemExit("Offline SQL generation is not supported; run against a database.")
run_migrations_online()
