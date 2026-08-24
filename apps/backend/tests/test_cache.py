from __future__ import annotations

import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

API_DIR = Path(__file__).resolve().parents[1]
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from rh_api.cache import CacheClient, cached


def _settings(redis_url: str = "") -> SimpleNamespace:
    return SimpleNamespace(redis_url=redis_url)


class CacheClientNoRedisConfiguredTests(unittest.TestCase):
    """Sem RH_REDIS_URL configurada: cache deve virar no-op silencioso, sem
    tocar em rede nenhuma (roadmap: cache/fila devem ser opcionais e
    degradáveis quando Redis não está disponível no ambiente)."""

    def test_get_is_always_miss_without_redis_url(self):
        client = CacheClient(_settings(redis_url=""))
        self.assertIsNone(client.get("qualquer-chave"))

    def test_set_does_nothing_without_redis_url(self):
        client = CacheClient(_settings(redis_url=""))
        # Não deve levantar exceção nenhuma.
        client.set("qualquer-chave", {"valor": 1}, ttl_seconds=30)
        self.assertIsNone(client.get("qualquer-chave"))

    def test_invalidate_does_nothing_without_redis_url(self):
        client = CacheClient(_settings(redis_url=""))
        client.invalidate("qualquer-chave")  # não deve levantar

    def test_warning_logged_only_once_across_many_calls(self):
        client = CacheClient(_settings(redis_url=""))
        with mock.patch("rh_api.cache.logger") as mock_logger:
            for _ in range(5):
                client.get("chave")
                client.set("chave", 1)
            self.assertEqual(mock_logger.warning.call_count, 1)


class CacheClientRedisImportMissingTests(unittest.TestCase):
    """Com RH_REDIS_URL configurada mas o pacote 'redis' não instalado
    (cenário real deste ambiente): também deve degradar para no-op."""

    def test_falls_back_to_noop_when_redis_package_missing(self):
        client = CacheClient(_settings(redis_url="redis://localhost:6379/0"))
        with mock.patch.dict(sys.modules, {"redis": None}):
            self.assertIsNone(client.get("chave"))


class CacheClientMockedRedisTests(unittest.TestCase):
    """Lógica de cache isolada, mockando um cliente Redis (rq/redis não
    precisam estar instalados de verdade para validar o comportamento)."""

    def _client_with_fake_redis(self, fake_redis) -> CacheClient:
        client = CacheClient(_settings(redis_url="redis://localhost:6379/0"))
        client._client = fake_redis
        client._attempted_connect = True
        return client

    def test_get_returns_deserialized_value_on_hit(self):
        fake_redis = mock.Mock()
        fake_redis.get.return_value = b'{"a": 1}'
        client = self._client_with_fake_redis(fake_redis)

        self.assertEqual(client.get("chave"), {"a": 1})

    def test_get_returns_none_on_miss(self):
        fake_redis = mock.Mock()
        fake_redis.get.return_value = None
        client = self._client_with_fake_redis(fake_redis)

        self.assertIsNone(client.get("chave"))

    def test_set_serializes_value_with_ttl(self):
        fake_redis = mock.Mock()
        client = self._client_with_fake_redis(fake_redis)

        client.set("chave", {"a": 1}, ttl_seconds=42)

        fake_redis.setex.assert_called_once()
        args, _ = fake_redis.setex.call_args
        self.assertEqual(args[0], "chave")
        self.assertEqual(args[1], 42)
        self.assertIn('"a": 1', args[2])

    def test_invalidate_deletes_key(self):
        fake_redis = mock.Mock()
        client = self._client_with_fake_redis(fake_redis)

        client.invalidate("chave")

        fake_redis.delete.assert_called_once_with("chave")

    def test_get_falls_back_to_none_when_redis_raises(self):
        fake_redis = mock.Mock()
        fake_redis.get.side_effect = RuntimeError("conexão perdida")
        client = self._client_with_fake_redis(fake_redis)

        self.assertIsNone(client.get("chave"))

    def test_set_never_raises_when_redis_fails(self):
        fake_redis = mock.Mock()
        fake_redis.setex.side_effect = RuntimeError("conexão perdida")
        client = self._client_with_fake_redis(fake_redis)

        client.set("chave", 1)  # não deve levantar


class CachedDecoratorTests(unittest.TestCase):
    def test_cached_decorator_calls_function_once_for_repeated_calls(self):
        fake_redis = mock.Mock()
        storage: dict[str, bytes] = {}

        def fake_get(key):
            return storage.get(key)

        def fake_setex(key, ttl, value):
            storage[key] = value.encode() if isinstance(value, str) else value

        fake_redis.get.side_effect = fake_get
        fake_redis.setex.side_effect = fake_setex

        cache_client = CacheClient(_settings(redis_url="redis://localhost:6379/0"))
        cache_client._client = fake_redis
        cache_client._attempted_connect = True

        calls = {"count": 0}

        class Repo:
            def __init__(self):
                self._cache = cache_client

            @cached(ttl_seconds=30)
            def get_value(self):
                calls["count"] += 1
                return {"value": calls["count"]}

        repo = Repo()
        first = repo.get_value()
        second = repo.get_value()

        self.assertEqual(first, {"value": 1})
        self.assertEqual(second, {"value": 1})
        self.assertEqual(calls["count"], 1)


if __name__ == "__main__":
    unittest.main()
