# ADR-329: reads run in autocommit and the pool does not pre-ping

**Status:** Accepted.

With 20,000 tasks loaded, a single unloaded request to `GET /tasks/{id}` took 19 to 25 ms in process,
and the API sustained only a few dozen requests a second, so every latency target failed under 20
users. Each request opens two units of work (the token's user, then the operation), and each cost
about a dozen database round trips at roughly 1 ms each.

- **Reads use autocommit.** A read-only unit of work runs its statements outside a transaction: no
  `BEGIN` and no `ROLLBACK`. At `READ COMMITTED` a transaction gives a read no extra consistency, so
  nothing is lost. Writes still use one transaction (BR-305), and `read_only` is a hint that the
  memory backend ignores.
- **No pool pre-ping.** Pre-ping spends a round trip on every checkout to find a dead connection
  early. Without it a dead connection fails on use, SQLAlchemy discards the whole pool, and the next
  request reconnects, so a database restart costs one burst of 503 answers instead of one extra round
  trip on every request. Recovery within 30 s with no restart still holds (TC-360).
- Connections older than 30 minutes are recycled.
