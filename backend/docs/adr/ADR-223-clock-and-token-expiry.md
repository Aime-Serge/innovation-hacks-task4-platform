# ADR-223: token expiry is checked against the injected clock

**Status:** Accepted.

PyJWT checks `exp` and `iat` against the wall clock, which made a token issued under the injected test clock look "not yet valid", and made expiry untestable without sleeping. `TokenCodec.subject` now verifies signature, algorithm (pinned to HS256), issuer, audience and the presence of every claim with PyJWT, and checks `exp` and `iat` itself against `Clock.now()`. Production behaviour is the same, because the production clock is the wall clock. The test suite can now advance time and prove that a token stops working after 15 minutes (TC-208).

The token's role claim is informational; the role is re-read from the user store on every request, so a demotion takes effect at once and a deleted user's token stops working (TC-302).
