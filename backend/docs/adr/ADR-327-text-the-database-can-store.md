# ADR-327: request text is limited to what PostgreSQL can store

**Status:** Accepted. It changes `docs/openapi.json`, so it is recorded here (NFR-325).

Schemathesis, run against PostgreSQL, found two 500 responses that the in-memory backend never had. A
text value containing a NUL character (`\u0000`) cannot be stored by PostgreSQL, and neither can an
unpaired surrogate (`\ud800` to `\udfff`). Both are refused at the edge now, with a 422:

- Every free-text request field (names, titles, descriptions, search text, email, password, avatar
  URL) carries a `pattern` that excludes the NUL, and the schema says so. The name and title patterns
  also still require at least one non-blank character. An unpaired surrogate is refused by a
  validator in `ApiModel` instead, because no schema pattern can state it portably; it is the one
  rejection the document does not promise.
- The patterns spell their character classes out and are checked with Python's regex engine,
  because the schema is read by ECMA engines and Rust's `\s` and surrogate handling differ (a fuzzer
  had already found addresses that the two disagreed on).
- A login email with a NUL is treated as an unknown address (401), and the database translator maps
  the two matching SQLSTATEs (`22021`, `22P05`) to a 422, so no such value can reach a client as 500.

**Effect on the contract.** Compared with the Task 2 baseline the document differs only in these
`pattern` keys and in the query parameter for `q`, which gains one. No path, method, status code,
response property or required field changed, and `make spec-diff` reports no breaking change. A test
(TC-394) fails on any other difference.
