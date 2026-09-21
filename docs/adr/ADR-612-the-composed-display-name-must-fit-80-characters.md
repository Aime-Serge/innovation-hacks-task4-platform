# ADR-612: The composed display name must fit 80 characters

**Status:** Accepted (from the readback, GAP-04).

**Reason.** Given and family names allow 60 characters each, but `users.name` allows 80. A combination longer than 80 fails validation with a per-field message; the `users.name` constraint is unchanged.

**Where it lives.** Registration and profile schemas (to be confirmed).
