"""Provider contract tests for the Gemini client, offline, via a mock transport (TC-445)."""

import json

import httpx
import pytest

from app.ai.client import LLMProviderError, LLMRateLimited, LLMTimeout
from app.ai.gemini_client import GeminiClient
from app.ai.schemas import TaskSuggestions

KEY = "test-key-not-a-secret"
GOOD = {
    "candidates": [{"content": {"parts": [{"text": json.dumps({"suggestions": []})}]}}],
    "usageMetadata": {"promptTokenCount": 11, "candidatesTokenCount": 7},
    "modelVersion": "gemini-test",
}


def client(handler: httpx.MockTransport | None = None, **kw: object) -> GeminiClient:
    return GeminiClient(KEY, "model-from-settings", transport=handler, **kw)  # type: ignore[arg-type]  # reason: test doubles


async def generate(c: GeminiClient):  # type: ignore[no-untyped-def]  # reason: return type is LLMResult
    return await c.generate(
        system="s", user="u", output_schema=TaskSuggestions, max_tokens=99, timeout_s=5
    )


async def test_tc445_a_good_answer_is_parsed_and_the_request_is_well_formed() -> None:
    seen: dict[str, httpx.Request] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["r"] = request
        return httpx.Response(200, json=GOOD)

    result = await generate(client(httpx.MockTransport(handler)))
    assert result.data == {"suggestions": []}
    assert (result.model, result.input_tokens, result.output_tokens) == ("gemini-test", 11, 7)
    request = seen["r"]
    assert request.url.path.endswith("/models/model-from-settings:generateContent")
    assert KEY not in str(request.url)  # the key is a header, never part of a URL that gets logged
    assert request.headers["x-goog-api-key"] == KEY
    body = json.loads(request.content)
    assert body["generationConfig"]["maxOutputTokens"] == 99
    assert body["generationConfig"]["responseMimeType"] == "application/json"
    assert "suggestions" in body["generationConfig"]["responseJsonSchema"]["properties"]
    assert body["systemInstruction"]["parts"][0]["text"] == "s"
    assert "tools" not in body  # the model is given no tools (ADR-410)


@pytest.mark.parametrize(
    ("status", "error", "retryable"),
    [
        (429, LLMRateLimited, None),
        (500, LLMProviderError, True),
        (503, LLMProviderError, True),
        (400, LLMProviderError, False),
        (403, LLMProviderError, False),
    ],
)
async def test_tc445_provider_errors_map_to_the_pipeline_errors(
    status: int, error: type[Exception], retryable: bool | None
) -> None:
    transport = httpx.MockTransport(lambda r: httpx.Response(status, json={"error": "x"}))
    with pytest.raises(error) as caught:
        await generate(client(transport))
    if retryable is not None:
        assert caught.value.retryable is retryable  # type: ignore[attr-defined]  # reason: narrowed by param


async def test_tc445_a_timeout_and_a_network_failure_are_mapped() -> None:
    def slow(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("slow", request=request)

    def down(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down", request=request)

    with pytest.raises(LLMTimeout):
        await generate(client(httpx.MockTransport(slow)))
    with pytest.raises(LLMProviderError) as caught:
        await generate(client(httpx.MockTransport(down)))
    assert caught.value.retryable is True


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"candidates": []},
        {"candidates": [{"content": {"parts": [{"text": "not json"}]}}]},
        {"candidates": [{"content": {"parts": [{"text": "[1, 2]"}]}}]},
    ],
)
async def test_tc445_an_unusable_answer_becomes_empty_data_for_the_validator(payload: dict) -> None:  # type: ignore[type-arg]  # reason: arbitrary JSON
    transport = httpx.MockTransport(lambda r: httpx.Response(200, json=payload))
    result = await generate(client(transport))
    assert result.data == {}  # the pipeline then treats it as invalid output (FR-428)
