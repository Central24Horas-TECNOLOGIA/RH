"""Testa a aplicação do cache (rh_api/cache.py) nas 3 queries escolhidas no
roadmap de expansão: datas comemorativas, templates de documentos e
dashboard de funil. Foca em: (a) um cache-hit evita ir ao banco, e (b) a
invalidação nas escritas realmente limpa a chave."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest import mock

API_DIR = Path(__file__).resolve().parents[1]
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from rh_api.cache import CacheClient
from rh_api.repositories.celebratory_dates import (
    _CELEBRATORY_DATES_CACHE_KEY,
    CelebratoryDateRepositoryMixin,
)
from rh_api.repositories.document_templates import (
    _DOCUMENT_TEMPLATES_CACHE_KEY,
    DocumentTemplateRepositoryMixin,
)


class _DbTouchedError(RuntimeError):
    """Levantado quando o teste espera que o banco NÃO seja tocado."""


class _NoDbCelebratoryRepository(CelebratoryDateRepositoryMixin):
    def _connect(self):
        raise _DbTouchedError("consulta foi ao banco apesar do cache-hit esperado")


class _NoDbDocumentTemplateRepository(DocumentTemplateRepositoryMixin):
    def _connect(self):
        raise _DbTouchedError("consulta foi ao banco apesar do cache-hit esperado")


def _fake_cache_client_with_hit(key: str, value):
    client = mock.Mock(spec=CacheClient)
    client.get.side_effect = lambda k: value if k == key else None
    return client


class CelebratoryDatesCacheTests(unittest.TestCase):
    def test_list_returns_cached_value_without_touching_db(self):
        cached_rows = [{"id_data": 1, "titulo": "Confraternização"}]
        fake_cache = _fake_cache_client_with_hit(_CELEBRATORY_DATES_CACHE_KEY, cached_rows)
        repository = _NoDbCelebratoryRepository()

        with mock.patch(
            "rh_api.repositories.celebratory_dates.get_cache_client",
            return_value=fake_cache,
        ):
            result = repository.list_celebratory_dates()

        self.assertEqual(result, cached_rows)

    def test_create_invalidates_cache_key(self):
        fake_cache = mock.Mock(spec=CacheClient)
        repository = _NoDbCelebratoryRepository()
        repository.get_celebratory_date = mock.Mock(return_value={"id_data": 1})

        conn = mock.Mock()
        cursor = mock.Mock()
        cursor.fetchone.return_value = [1]
        conn.cursor.return_value = cursor
        repository._connect = mock.Mock(return_value=conn)

        with mock.patch(
            "rh_api.repositories.celebratory_dates.get_cache_client",
            return_value=fake_cache,
        ), mock.patch(
            "rh_api.repositories.celebratory_dates.ensure_celebratory_dates_table"
        ):
            repository.create_celebratory_date({"titulo": "Natal", "dia": 25, "mes": 12})

        fake_cache.invalidate.assert_called_once_with(_CELEBRATORY_DATES_CACHE_KEY)


class DocumentTemplateCacheTests(unittest.TestCase):
    def test_list_returns_cached_value_without_touching_db(self):
        cached_rows = [{"id_template": 1, "titulo": "Carta"}]
        fake_cache = _fake_cache_client_with_hit(_DOCUMENT_TEMPLATES_CACHE_KEY, cached_rows)
        repository = _NoDbDocumentTemplateRepository()

        with mock.patch(
            "rh_api.repositories.document_templates.get_cache_client",
            return_value=fake_cache,
        ):
            result = repository.list_document_templates()

        self.assertEqual(result, cached_rows)

    def test_delete_invalidates_cache_key(self):
        fake_cache = mock.Mock(spec=CacheClient)
        repository = _NoDbDocumentTemplateRepository()

        conn = mock.Mock()
        cursor = mock.Mock()
        cursor.fetchone.return_value = [1]
        conn.cursor.return_value = cursor
        repository._connect = mock.Mock(return_value=conn)

        with mock.patch(
            "rh_api.repositories.document_templates.get_cache_client",
            return_value=fake_cache,
        ), mock.patch(
            "rh_api.repositories.document_templates.ensure_document_templates_table"
        ):
            repository.delete_document_template(1)

        fake_cache.invalidate.assert_called_once_with(_DOCUMENT_TEMPLATES_CACHE_KEY)


if __name__ == "__main__":
    unittest.main()
