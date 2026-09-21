"""The provider port (FR-427, ADR-407): services depend on this, never on a vendor."""

from dataclasses import dataclass
from typing import Any, Protocol

from pydantic import BaseModel


class LLMError(Exception):
    """Base for everything a provider can do wrong; the pipeline maps these to API errors."""


class LLMTimeout(LLMError):
    pass


class LLMRateLimited(LLMError):
    pass


class LLMProviderError(LLMError):
    def __init__(self, message: str, *, retryable: bool = False) -> None:
        super().__init__(message)
        self.retryable = retryable  # a provider 5xx may be retried once; anything else may not


@dataclass(frozen=True)
class LLMResult:
    data: dict[str, Any]  # parsed JSON for the requested schema
    model: str
    input_tokens: int
    output_tokens: int
    latency_ms: int


class LLMClient(Protocol):
    async def generate(
        self,
        *,
        system: str,
        user: str,
        output_schema: type[BaseModel],
        max_tokens: int,
        timeout_s: float,
    ) -> LLMResult: ...
