# ADR-315: the domain `User` does not compare or print its password hash

**Status:** Accepted.

NFR-318 says `password_hash` is selected only by the login lookup, so every other read returns a user with an empty hash. Task 2's repository contract test, which must not change, asserts `get(id) == user` for a user that carries a hash. The two only agree if the hash is not part of equality, so `User.password_hash` is `field(compare=False, repr=False)`. As a side effect a hash can no longer appear in a log line through `repr`.

`update` never writes the hash (the API has no password change), so a user loaded without it cannot overwrite the stored one with an empty string. A query-capture test (TC-335) proves that exactly one SELECT names the column.
