"""Task 4 settings: pack names, old-name aliases and the AI refusals (FR-427, BR-409, ADR-418)."""

import pytest
from pydantic import SecretStr, ValidationError

from app.core.config import Settings

SECRET = "x" * 40


def make(**values: object) -> Settings:
    return Settings(_env_file=None, secret_key=SecretStr(SECRET), **values)  # type: ignore[arg-type]  # reason: kwargs are validated by pydantic


def test_fr427_fake_provider_is_the_default_and_allowed_outside_production() -> None:
    settings = make()
    assert settings.llm_provider == "fake"
    assert settings.ai_enabled is True
    assert settings.registration_enabled is True


def test_fr427_production_refuses_the_fake_provider() -> None:
    with pytest.raises(ValidationError, match="LLM_PROVIDER"):
        make(
            app_env="production",
            storage_backend="sql",
            database_url=SecretStr("postgresql+asyncpg://u:<set-me>@h/db?ssl=require"),
        )


def test_fr427_a_live_provider_needs_its_key_and_model_by_name() -> None:
    with pytest.raises(ValidationError, match="LLM_API_KEY"):
        make(llm_provider="gemini", llm_model="m")
    with pytest.raises(ValidationError, match="LLM_MODEL"):
        make(llm_provider="gemini", llm_api_key=SecretStr("k"))
    ok = make(llm_provider="gemini", llm_api_key=SecretStr("k"), llm_model="m")
    assert ok.llm_model == "m"


def test_br409_quota_defaults_and_br404_token_lifetimes() -> None:
    settings = make()
    assert (settings.ai_daily_limit_per_user, settings.ai_per_minute_limit) == (20, 5)
    assert settings.ai_global_daily_limit == 500
    assert settings.access_token_ttl_seconds == 900
    assert settings.refresh_token_ttl_seconds == 604_800


def test_adr418_pack_names_win_and_old_names_still_work(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SECRET_KEY", "o" * 40)
    monkeypatch.setenv("CORS_ORIGINS", "https://old.example")
    old = Settings(_env_file=None)
    assert old.secret_key.get_secret_value() == "o" * 40
    assert old.cors_origins == ["https://old.example"]
    monkeypatch.setenv("JWT_SECRET", "n" * 40)
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "https://new.example")
    new = Settings(_env_file=None)
    assert new.secret_key.get_secret_value() == "n" * 40
    assert new.cors_origins == ["https://new.example"]
