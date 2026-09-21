# ADR-322: activity ties break by id descending in both backends

**Status:** Accepted.

The pack's index is `activity (at DESC, id DESC)`. The in-memory backend broke ties by id ascending, so a query that used the index would have returned equal timestamps in a different order from memory. Memory now orders by `(at, id)` descending. Only events with an identical timestamp are affected.
