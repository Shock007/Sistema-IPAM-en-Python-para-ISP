"""Límite de intentos fallidos de PIN (en memoria; por proceso)."""
import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, status


class FailedAttemptLimiter:
    def __init__(self, max_failures: int = 5, window_seconds: int = 300):
        self.max_failures = max_failures
        self.window = window_seconds
        self._fails: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def _prune(self, q: deque) -> None:
        now = time.monotonic()
        while q and now - q[0] > self.window:
            q.popleft()

    def check(self, key: str) -> None:
        with self._lock:
            q = self._fails[key]
            self._prune(q)
            if len(q) >= self.max_failures:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Demasiados intentos fallidos de PIN. Intente más tarde.",
                )

    def register_failure(self, key: str) -> None:
        with self._lock:
            self._fails[key].append(time.monotonic())

    def reset(self, key: str) -> None:
        with self._lock:
            self._fails.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._fails.clear()


pin_limiter = FailedAttemptLimiter()