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

    # Comma-separated list of allowed frontend origins for CORS. Required
    # for the auth cookie: credentialed cross-origin requests need an
    # explicit origin list, not "*".
    cors_origins: str = "http://localhost:3000"

    # AI feature. Optional — the AI-assisted task generation endpoint
    # falls back to a deterministic generator when this is unset or the
    # API call fails. Gemini (not Anthropic) specifically because it has
    # a genuine free tier — no billing required to get a working key,
    # which matters for a project graded without a budget attached.
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.5-flash"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
