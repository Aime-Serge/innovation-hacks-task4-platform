from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_env: str = "development"
    host: str = "0.0.0.0"
    port: int = 8000
    log_level: str = "info"

    # Placeholders for future tasks — no consumer yet, defined now so
    # Task 3 (database) and Task 4 (auth) don't need new config plumbing.
    database_url: str | None = None
    secret_key: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
