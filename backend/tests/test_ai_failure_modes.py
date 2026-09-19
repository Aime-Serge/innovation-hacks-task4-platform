"""Unit-level tests for _call_gemini's failure handling — deliberately
independent of the database (no client/project fixtures), since these
exercise a pure function: given a mocked Gemini client, does each
distinct failure mode correctly resolve to None (the signal the caller
uses to fall back), and does the happy path still parse correctly?

Every exception type mocked here was verified against the real SDK
(google-genai 2.22.0) and the real API before writing these — not
guessed: a genuine timeout raises httpx.ConnectTimeout (not wrapped by
the SDK), and google.genai.errors.ClientError/ServerError both subclass
APIError.

test_ai.py covers this same behavior at the HTTP-endpoint level (with a
real database), for the one failure mode that's actually reachable in a
CI environment without a real API key. These tests cover the modes that
aren't: timeout, rate limit, and two shapes of malformed response.
"""

import httpx
import pytest
from google.genai import errors as genai_errors

import app.routers.ai as ai_module
from app.config import get_settings


@pytest.fixture(autouse=True)
def gemini_api_key(monkeypatch):
    """_call_gemini short-circuits to None immediately if no key is
    configured — these tests are about what happens once a key *is*
    configured but the call still fails, so give it one."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key-for-unit-test")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def patch_gemini_client(monkeypatch):
    def _patch(client_factory):
        monkeypatch.setattr("google.genai.Client", client_factory)

    return _patch


def _mock_client(generate_content_fn):
    class _Models:
        def generate_content(self, *args, **kwargs):
            return generate_content_fn(*args, **kwargs)

    class _Client:
        def __init__(self, *args, **kwargs):
            self.models = _Models()

    return _Client


def test_timeout_falls_back(patch_gemini_client):
    def raise_timeout(*a, **k):
        raise httpx.ConnectTimeout("timed out")

    patch_gemini_client(_mock_client(raise_timeout))
    assert ai_module._call_gemini("Atlas Gateway", "desc", None, 3) is None


def test_rate_limit_falls_back(patch_gemini_client):
    def raise_rate_limit(*a, **k):
        raise genai_errors.ClientError(429, {"error": {"message": "rate limited"}})

    patch_gemini_client(_mock_client(raise_rate_limit))
    assert ai_module._call_gemini("Atlas Gateway", "desc", None, 3) is None


def test_server_error_falls_back(patch_gemini_client):
    def raise_server_error(*a, **k):
        raise genai_errors.ServerError(503, {"error": {"message": "unavailable"}})

    patch_gemini_client(_mock_client(raise_server_error))
    assert ai_module._call_gemini("Atlas Gateway", "desc", None, 3) is None


def test_response_with_invalid_json_falls_back(patch_gemini_client):
    def return_not_json(*a, **k):
        class _Response:
            text = "not valid json at all"

        return _Response()

    patch_gemini_client(_mock_client(return_not_json))
    assert ai_module._call_gemini("Atlas Gateway", "desc", None, 3) is None


def test_response_with_wrong_shape_falls_back(patch_gemini_client):
    def return_bad_shape(*a, **k):
        class _Response:
            text = '{"not_tasks": []}'  # valid JSON, missing the required "tasks" key

        return _Response()

    patch_gemini_client(_mock_client(return_bad_shape))
    assert ai_module._call_gemini("Atlas Gateway", "desc", None, 3) is None


def test_well_formed_response_is_parsed(patch_gemini_client):
    def return_valid(*a, **k):
        class _Response:
            text = (
                '{"tasks": ['
                '{"title": "Add rate limiting", "description": "desc", "priority": "high"},'
                '{"title": "Write docs", "description": "desc", "priority": "low"}'
                "]}"
            )

        return _Response()

    patch_gemini_client(_mock_client(return_valid))
    result = ai_module._call_gemini("Atlas Gateway", "desc", None, 3)
    assert result is not None
    assert len(result) == 2
    assert result[0].title == "Add rate limiting"
    assert result[0].priority.value == "high"


def test_no_api_key_short_circuits_without_calling_the_client(patch_gemini_client, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    get_settings.cache_clear()

    def fail_if_called(*a, **k):
        raise AssertionError("should never construct a client without an API key")

    patch_gemini_client(fail_if_called)
    assert ai_module._call_gemini("Atlas Gateway", "desc", None, 3) is None
