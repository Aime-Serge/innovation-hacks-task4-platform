# ADR-224: path parameters are camelCase too

**Status:** Accepted.

The pack writes routes as `/users/{userId}`. FastAPI's natural spelling is `{user_id}`, and the generated OpenAPI document followed it until a test that checks every name in the document caught the mismatch (TC-311). Path parameters now use `Path(alias="userId")` (and `projectId`, `taskId`), so the document, the Postman collection and the generated client all use one naming style.
