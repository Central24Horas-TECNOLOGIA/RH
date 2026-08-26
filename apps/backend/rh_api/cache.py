"""Cache de queries com Redis (roadmap de expansão, respostas.txt: cache para
reduzir carga em consultas lidas com frequência e que mudam pouco).

Infraestrutura leve e opcional/degradável (CLAUDE.md): se `RH_REDIS_URL` não
estiver configurada, se o cliente `redis` não estiver instalado, ou se a
conexão falhar por qualquer motivo (Redis fora do ar, timeout, etc.), o
cache vira silenciosamente um no-op — todo `get()` é sempre um "miss" e o
chamador segue direto para o banco, exatamente como funciona hoje sem cache
nenhum. Nunca deixamos uma falha de Redis derrubar uma request.

Modelo seguido: `rh_api/scheduler.py` (degradação do APScheduler).
"""

from __future__ import annotations

import functools
import json
import logging
import threading
from typing import Any, Callable

from .config import Settings, get_settings

logger = logging.getLogger(__name__)

# Timeout curto de conexão/leitura: se o Redis estiver fora do ar, não podemos
# deixar uma request HTTP travada esperando por ele.
_CONNECT_TIMEOUT_SECONDS = 1.5
_SOCKET_TIMEOUT_SECONDS = 1.5


class CacheClient:
    """Cliente de cache com Redis, com fallback silencioso para no-op.

    Uso típico via o singleton `get_cache_client()`, mas a classe também pode
    ser instanciada diretamente (útil em testes, injetando um cliente Redis
    fake em `_client`).
    """

    def __init__(self, settings: Settings | None = None):
        self._settings = settings or get_settings()
        self._client = None
        self._attempted_connect = False
        self._disabled_warning_logged = False
        self._lock = threading.Lock()

    # -- conexão -----------------------------------------------------------
    def _log_disabled_once(self, message: str, *, exc_info: bool = False) -> None:
        if self._disabled_warning_logged:
            return
        self._disabled_warning_logged = True
        logger.warning(message, exc_info=exc_info)

    def _get_client(self):
        if self._client is not None:
            return self._client
        if self._attempted_connect:
            return None
        with self._lock:
            if self._attempted_connect:
                return self._client
            self._attempted_connect = True

            redis_url = getattr(self._settings, "redis_url", "") or ""
            if not redis_url:
                self._log_disabled_once(
                    "RH_REDIS_URL não configurada; cache de queries desativado "
                    "(sempre cache-miss, consultas seguem direto para o banco)."
                )
                return None

            try:
                import redis  # type: ignore[import-not-found]
            except ImportError:
                self._log_disabled_once(
                    "Dependência opcional 'redis' não instalada; cache de queries "
                    "desativado (sempre cache-miss). Instale 'redis' para habilitar."
                )
                return None

            try:
                client = redis.from_url(
                    redis_url,
                    socket_connect_timeout=_CONNECT_TIMEOUT_SECONDS,
                    socket_timeout=_SOCKET_TIMEOUT_SECONDS,
                )
                client.ping()
            except Exception:
                self._log_disabled_once(
                    "Não foi possível conectar ao Redis (RH_REDIS_URL); cache de "
                    "queries desativado (sempre cache-miss, o restante do backend "
                    "continua funcionando normalmente).",
                    exc_info=True,
                )
                return None

            self._client = client
            return client

    # -- API pública ---------------------------------------------------------
    def get(self, key: str) -> Any:
        client = self._get_client()
        if client is None:
            return None
        try:
            raw = client.get(key)
        except Exception:
            self._log_disabled_once(
                "Falha ao ler do Redis; cache de queries seguirá em modo "
                "no-op para as próximas chamadas.",
                exc_info=True,
            )
            return None
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except (TypeError, ValueError):
            return None

    def set(self, key: str, value: Any, ttl_seconds: int = 60) -> None:
        client = self._get_client()
        if client is None:
            return
        try:
            client.setex(key, max(1, int(ttl_seconds)), json.dumps(value, default=str))
        except Exception:
            logger.debug("Falha ao gravar no cache Redis (chave=%s).", key, exc_info=True)

    def invalidate(self, key: str) -> None:
        client = self._get_client()
        if client is None:
            return
        try:
            client.delete(key)
        except Exception:
            logger.debug("Falha ao invalidar chave no cache Redis (chave=%s).", key, exc_info=True)


_singleton_lock = threading.Lock()
_singleton_client: CacheClient | None = None


def get_cache_client() -> CacheClient:
    """Singleton de processo do `CacheClient`, criado sob demanda."""
    global _singleton_client
    if _singleton_client is None:
        with _singleton_lock:
            if _singleton_client is None:
                _singleton_client = CacheClient()
    return _singleton_client


def reset_cache_client_for_tests() -> None:
    """Só para testes: força recriação do singleton na próxima chamada."""
    global _singleton_client
    _singleton_client = None


def cached(ttl_seconds: int = 60, *, key_func: Callable[..., str] | None = None):
    """Decorator simples de cache. `key_func(*args, **kwargs)` define a chave;
    por padrão usa o nome qualificado da função (sem argumentos) — adequado
    para consultas sem parâmetros (ex.: listagens). Para consultas
    parametrizadas, informe `key_func`.

    Requer que o primeiro argumento posicional seja `self` de um repositório
    com `self._cache` (ou usa `get_cache_client()` como padrão).
    """

    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            cache_client = getattr(args[0], "_cache", None) if args else None
            if cache_client is None:
                cache_client = get_cache_client()

            if key_func is not None:
                cache_key = key_func(*args, **kwargs)
            else:
                cache_key = f"conecta:cache:{func.__module__}.{func.__qualname__}"

            cached_value = cache_client.get(cache_key)
            if cached_value is not None:
                return cached_value

            result = func(*args, **kwargs)
            cache_client.set(cache_key, result, ttl_seconds=ttl_seconds)
            return result

        return wrapper

    return decorator
