"""A small in-process rate limiter for the answer endpoint.

Ingestion never uses this limiter; it protects the expensive, model-backed
``/ask`` route so one visitor cannot drain the operator's quota.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from collections.abc import Callable


class SlidingWindowRateLimiter:
    def __init__(
        self,
        limit: int,
        *,
        window_seconds: float = 60.0,
        clock: Callable[[], float] | None = None,
    ) -> None:
        if limit < 1:
            raise ValueError("limit must be at least 1")
        self.limit = limit
        self.window_seconds = window_seconds
        self._clock = clock or time.monotonic
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str) -> tuple[bool, int]:
        """Return ``(allowed, retry_after_seconds)`` and record an allowed hit."""

        now = self._clock()
        with self._lock:
            bucket = self._events[key]
            cutoff = now - self.window_seconds
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()
            if len(bucket) >= self.limit:
                retry_after = max(1, int(self.window_seconds - (now - bucket[0])))
                return False, retry_after
            bucket.append(now)
            return True, 0


__all__ = ["SlidingWindowRateLimiter"]
