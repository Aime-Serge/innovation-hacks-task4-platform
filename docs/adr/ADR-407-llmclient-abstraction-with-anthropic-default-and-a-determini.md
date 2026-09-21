# ADR-407: `LLMClient` abstraction with Anthropic default and a deterministic fake

**Status:** Accepted (from the Task 4 pack, section 7).

**Reason.** Provider independence, free testing, offline demo

**Where it lives.** `backend/app/ai/client.py`, `fake_client.py`, `gemini_client.py`, ADR-424 (Gemini is the live provider).
