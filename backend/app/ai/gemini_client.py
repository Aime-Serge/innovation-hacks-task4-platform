"""Google Gemini behind `LLMClient` (FR-427, ADR-424).

Structured output goes through `responseJsonSchema` with a JSON mime type, so the model returns
JSON for the schema and nothing is scraped out of free text (ADR-408). The API key is only sent as
a header (never in the URL, so it cannot land in a log), and the model name is whatever `LLM_MODEL`
says: it is never hard-coded.
"""

import json
import time
from typing import Any

import httpx
from pydantic import BaseModel

from app.ai.client import LLMProviderError, LLMRateLimited, LLMResult, LLMTimeout

BASE_URL = "https://generativelanguage.googleapis.com/v1beta"


class GeminiClient:
    def __init__(
        self,
        api_key: str,
        model: str,
        *,
        base_url: str = BASE_URL,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._key = api_key
        self._model = model
        self._base = base_url.rstrip("/")
        self._transport = transport

    async def generate(
        self,
        *,
        system: str,
        user: str,
        output_schema: type[BaseModel],
        max_tokens: int,
        timeout_s: float,
    ) -> LLMResult:
        body: dict[str, Any] = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": {
                "maxOutputTokens": max_tokens,
                "temperature": 0.4,
                "responseMimeType": "application/json",
                "responseJsonSchema": output_schema.model_json_schema(by_alias=True),
            },
        }
        url = f"{self._base}/models/{self._model}:generateContent"
        started = time.monotonic()
        try:
            async with httpx.AsyncClient(transport=self._transport, timeout=timeout_s) as http:
                response = await http.post(url, json=body, headers={"x-goog-api-key": self._key})
        except httpx.TimeoutException:
            raise LLMTimeout("the provider did not answer in time") from None
        except httpx.HTTPError:
            raise LLMProviderError("the provider could not be reached", retryable=True) from None
        if response.status_code == 429:
            raise LLMRateLimited("the provider rate limited the request")
        if response.status_code >= 500:
            raise LLMProviderError(f"provider error {response.status_code}", retryable=True)
        if response.status_code >= 400:
            raise LLMProviderError(f"provider refused the request ({response.status_code})")
        try:
            payload = response.json()
            text = payload["candidates"][0]["content"]["parts"][0]["text"]
            data = json.loads(text)
            if not isinstance(data, dict):
                raise TypeError("not an object")
            usage = payload.get("usageMetadata", {})
            model = str(payload.get("modelVersion", self._model))
        except (ValueError, KeyError, IndexError, TypeError):
            # A blocked or truncated answer has no usable JSON; the pipeline treats it as invalid.
            data, usage, model = {}, {}, self._model
        return LLMResult(
            data=data,
            model=model,
            input_tokens=int(usage.get("promptTokenCount", 0)),
            output_tokens=int(usage.get("candidatesTokenCount", 0)),
            latency_ms=int((time.monotonic() - started) * 1000),
        )
