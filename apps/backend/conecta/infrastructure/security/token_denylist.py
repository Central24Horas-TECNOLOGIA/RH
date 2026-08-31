"""Denylist de tokens revogados (ex.: logout) — em memória, por processo.

Mesma limitação documentada em `rate_limit.py`: por processo, deve ser trocado
por um backend compartilhado (Redis, já opcional no projeto) antes de escalar
para múltiplas réplicas — ver achado SEC-007/S-07. Cada entrada expira sozinha
no tempo restante do próprio token (nunca precisa durar mais que isso).
"""

from __future__ import annotations

import threading
import time


class InMemoryTokenDenylist:
    def __init__(self) -> None:
        self._revoked: dict[str, float] = {}
        self._lock = threading.Lock()

    def revoke(self, token_key: str, ttl_seconds: float) -> None:
        if not token_key or ttl_seconds <= 0:
            return
        expires_at = time.monotonic() + ttl_seconds
        with self._lock:
            self._purge_expired_locked()
            self._revoked[token_key] = expires_at

    def is_revoked(self, token_key: str) -> bool:
        with self._lock:
            self._purge_expired_locked()
            return token_key in self._revoked

    def _purge_expired_locked(self) -> None:
        now = time.monotonic()
        expired = [key for key, expiry in self._revoked.items() if expiry <= now]
        for key in expired:
            del self._revoked[key]
