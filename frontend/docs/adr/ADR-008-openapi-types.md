# ADR-008 (Pack ADR-008): types generated from the OpenAPI schema

**Status:** Accepted, not yet applicable

Task 1 has no backend. The Zod schemas in `src/schemas` are the contract today and mirror the Task 2 API's entities and error envelope. When Task 2 lands, types are generated from the FastAPI OpenAPI document and the schemas are checked against them by the contract tests in `tests/contract`.
