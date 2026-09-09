"""Unit-level tests for _call_anthropic's failure handling — deliberately
independent of the database (no client/project fixtures), since these
exercise a pure function: given a mocked Anthropic client, does each
distinct failure mode correctly resolve to None (the signal the caller
uses to fall back), and does the happy path still parse correctly?

test_ai.py covers this same behavior at the HTTP-endpoint level (with a
real database), for the one failure mode that's actually reachable in a
CI environment without a real API key. These tests cover the modes that
aren't: timeout, rate limit, and two shapes of malformed response.
"""

from unittest.mock import MagicMock

import anthropic
import pytest

import app.routers.ai as ai_module
from app.config import get_settings


@pytest.fixture(autouse=True)
def anthropic_api_key(monkeypatch):
    """_call_anthropic short-circuits to None immediately if no key is
    configured — these tests are about what happens once a key *is*
    configured but the call still fails, so give it one."""
    monkeypatch.setenv("ANTHROPIC_API_KEY", "fake-key-for-unit-test")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def patch_anthropic_client(monkeypatch):
    def _patch(client_factory):
        monkeypatch.setattr(ai_module.anthropic, "Anthropic", client_factory)

    return _patch


def _mock_client(create_fn):
    class _Client:
        def __init__(self, *args, **kwargs):
            self.messages = self

        def create(self, *args, **kwargs):
            return create_fn(*args, **kwargs)

    return _Client


def test_timeout_falls_back(patch_anthropic_client):
    def raise_timeout(*a, **k):
        raise anthropic.APITimeoutError(request=MagicMock())

    patch_anthropic_client(_mock_client(raise_timeout))
    assert ai_module._call_anthropic("Atlas Gateway", "desc", None, 3) is None


def test_rate_limit_falls_back(patch_anthropic_client):
    def raise_rate_limit(*a, **k):
        raise anthropic.RateLimitError(
            "rate limited", response=MagicMock(status_code=429, headers={}), body=None
        )

    patch_anthropic_client(_mock_client(raise_rate_limit))
    assert ai_module._call_anthropic("Atlas Gateway", "desc", None, 3) is None


def test_response_with_no_tool_use_block_falls_back(patch_anthropic_client):
    def return_text_only(*a, **k):
        block = MagicMock()
        block.type = "text"
        return MagicMock(content=[block])

    patch_anthropic_client(_mock_client(return_text_only))
    assert ai_module._call_anthropic("Atlas Gateway", "desc", None, 3) is None


def test_response_with_malformed_tool_input_falls_back(patch_anthropic_client):
    def return_bad_shape(*a, **k):
        block = MagicMock()
        block.type = "tool_use"
        block.name = "propose_tasks"
        block.input = {"not_tasks": []}  # missing the required "tasks" key
        return MagicMock(content=[block])

    patch_anthropic_client(_mock_client(return_bad_shape))
    assert ai_module._call_anthropic("Atlas Gateway", "desc", None, 3) is None


def test_well_formed_response_is_parsed(patch_anthropic_client):
    def return_valid(*a, **k):
        block = MagicMock()
        block.type = "tool_use"
        block.name = "propose_tasks"
        block.input = {
            "tasks": [
                {"title": "Add rate limiting", "description": "desc", "priority": "high"},
                {"title": "Write docs", "description": "desc", "priority": "low"},
            ]
        }
        return MagicMock(content=[block])

    patch_anthropic_client(_mock_client(return_valid))
    result = ai_module._call_anthropic("Atlas Gateway", "desc", None, 3)
    assert result is not None
    assert len(result) == 2
    assert result[0].title == "Add rate limiting"
    assert result[0].priority.value == "high"


def test_no_api_key_short_circuits_without_calling_the_client(patch_anthropic_client, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    get_settings.cache_clear()

    def fail_if_called(*a, **k):
        raise AssertionError("should never construct a client without an API key")

    patch_anthropic_client(fail_if_called)
    assert ai_module._call_anthropic("Atlas Gateway", "desc", None, 3) is None
