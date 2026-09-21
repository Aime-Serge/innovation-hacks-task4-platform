# ADR-424: Gemini is the live AI provider; Anthropic is not implemented

**Status:** Accepted, at the owner's direction.

The pack names an Anthropic implementation behind `LLMClient` (FR-427, ADR-407). The owner will use Google Gemini as the live provider, so `LLM_PROVIDER` accepts `gemini` and `fake`, and a `GeminiClient` implements the same interface. The abstraction is exactly what makes this a swap of one class: the pipeline, prompts, validation, quotas, usage records and tests do not change.

What stays the same by rule: the model name comes only from `LLM_MODEL` and is never hard-coded; the key is set only in the platform dashboard and is sent as a header, never in a URL; `fake` is refused in production; output is requested against a JSON schema (`responseJsonSchema`) and validated to BR-408; a blocked or malformed provider answer is treated as invalid output. Where the pack says "Anthropic" it now reads "Gemini". The provider's data-retention and training terms still have to be reviewed by the owner before real data is used (section 9).
