from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import patch

from rh_api.repositories.history import HistoryRepositoryMixin
from rh_api.repositories.processes import ProcessRepositoryMixin
from rh_api.schemas.interviews import InterviewUpdateRequest


class FakeHistoryCursor:
    def __init__(self, columns_meta, identity_columns: set[str] | None = None):
        self._columns_meta = columns_meta
        self._identity_columns = identity_columns or set()
        self.executed: list[tuple[str, tuple]] = []
        self._fetchone_result = None

    def columns(self, table: str = "", schema: str | None = None):
        if table == "historico_provas":
            return self._columns_meta
        return []

    def execute(self, query: str, params=()):
        safe_params = tuple(params) if isinstance(params, (list, tuple)) else (params,)
        self.executed.append((query, safe_params))
        if "COLUMNPROPERTY" in query:
            column_name = safe_params[0] if safe_params else ""
            self._fetchone_result = (1 if column_name in self._identity_columns else 0,)
        else:
            self._fetchone_result = None

    def fetchone(self):
        return self._fetchone_result


class FakeHistoryConnection:
    def __init__(self, cursor: FakeHistoryCursor):
        self._cursor = cursor
        self.committed = False
        self.closed = False

    def cursor(self):
        return self._cursor

    def commit(self):
        self.committed = True

    def close(self):
        self.closed = True


class FakeHistoryRepository(HistoryRepositoryMixin):
    def __init__(self, connection: FakeHistoryConnection):
        self._connection = connection

    def _connect(self):
        return self._connection


class HistoryAndProcessRulesTests(unittest.TestCase):
    def test_history_insert_includes_codigo_when_column_is_not_identity(self):
        columns = [
            SimpleNamespace(column_name="Código"),
            SimpleNamespace(column_name="id_teste"),
            SimpleNamespace(column_name="nome_candidato"),
            SimpleNamespace(column_name="vaga"),
        ]
        cursor = FakeHistoryCursor(columns)
        conn = FakeHistoryConnection(cursor)
        repository = FakeHistoryRepository(conn)

        with (
            patch("rh_api.repositories.history.ensure_process_reference_columns", lambda _cursor: None),
            patch("rh_api.repositories.history.ensure_decimal_process_columns", lambda _cursor: None),
        ):
            payload = {
                "id_teste": "TESTE-001",
                "nome_candidato": "Ana Souza",
                "vaga": "Analista",
            }
            result = repository.save_history(payload)

        self.assertEqual(result, {"success": True})
        insert_query, insert_params = cursor.executed[-1]
        self.assertIn("[Código]", insert_query)
        self.assertEqual(insert_params[0], "TESTE-001")
        self.assertTrue(conn.committed)

    def test_history_insert_omits_codigo_when_column_is_identity(self):
        columns = [
            SimpleNamespace(column_name="Código"),
            SimpleNamespace(column_name="id_teste"),
            SimpleNamespace(column_name="nome_candidato"),
        ]
        cursor = FakeHistoryCursor(columns, identity_columns={"Código"})
        conn = FakeHistoryConnection(cursor)
        repository = FakeHistoryRepository(conn)

        with (
            patch("rh_api.repositories.history.ensure_process_reference_columns", lambda _cursor: None),
            patch("rh_api.repositories.history.ensure_decimal_process_columns", lambda _cursor: None),
        ):
            repository.save_history(
                {
                    "id_teste": "TESTE-002",
                    "nome_candidato": "Joao Lima",
                }
            )

        insert_query, insert_params = cursor.executed[-1]
        self.assertNotIn("[Código]", insert_query)
        self.assertEqual(insert_params[0], "TESTE-002")

    def test_process_rule_preserves_compareceu_during_proof_save(self):
        self.assertEqual(
            ProcessRepositoryMixin._preserve_existing_process_status(
                "Compareceu",
                "Analise",
            ),
            "Compareceu",
        )
        self.assertEqual(
            ProcessRepositoryMixin._preserve_existing_process_status(
                "Compareceu",
                "Eliminado",
            ),
            "Eliminado",
        )

    def test_interview_update_schema_accepts_final_statuses(self):
        payload = InterviewUpdateRequest(status_entrevista="Banco de talentos")
        self.assertEqual(payload.status_entrevista, "Banco de talentos")


if __name__ == "__main__":
    unittest.main()
