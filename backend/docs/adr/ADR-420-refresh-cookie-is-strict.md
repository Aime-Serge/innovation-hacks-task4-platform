# ADR-420: The refresh cookie is SameSite=Strict, the access cookie Lax

**Status:** Accepted.

FR-405 says `SameSite=Lax` for the session cookies while section 9 says `Strict` for the refresh cookie. The stricter reading is used for the refresh cookie, which is also limited to the path `/api/bff/auth`, so it is never sent on a cross-site navigation. The access cookie stays `Lax` so a link into the site keeps the person signed in.
