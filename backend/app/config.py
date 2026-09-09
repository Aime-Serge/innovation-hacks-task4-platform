from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_env: str = "development"
    host: str = "0.0.0.0"
    port: int = 8000
    log_level: str = "info"

    database_url: str | None = None

    # Auth (Task 4). secret_key signs JWTs — must be set to a long random
    # value outside development; there is no insecure default.
    secret_key: str | None = None
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 1 day


@lru_cache
def get_settings() -> Settings:
    return Settings()
