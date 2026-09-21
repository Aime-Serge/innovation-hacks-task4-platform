"""In-process sliding-window limiter keyed by client and email (NFR-216, ADR-216).

Counts per worker, so it is only accurate with one worker (section 9 limitation).
"""

import math
from collections import defaultdict, deque

from app.core.clock import Clock
from app.core.errors import RateLimited


class RateLimiter:
    def __init__(self, clock: Clock, attempts: int, window_seconds: int) -> None:
        self._clock = clock
        self._attempts = attempts
        self._window = window_seconds
        self._hits: defaultdict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str) -> None:
        """Record an attempt; raise RateLimited when the window is already full."""
        now = self._clock.now().timestamp()
        hits = self._hits[key]
        while hits and now - hits[0] >= self._window:
            hits.popleft()
        if len(hits) >= self._attempts:
            retry_after = max(1, math.ceil(self._window - (now - hits[0])))
            raise RateLimited("Too many attempts. Try again later.", retry_after)
        hits.append(now)
