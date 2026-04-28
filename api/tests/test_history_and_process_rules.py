from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import patch

from rh_api.repositories.history import HistoryRepositoryMixin
from rh_api.repositories.processes import ProcessRepositoryMixin
from rh_api.schemas.interviews import InterviewSlotCreateRequest, InterviewUpdateRequest


class FakeHistoryCursor:
    def __init__(
        self,
        columns_meta,
        identity_columns: set[str] | None = None,
        next_numeric_value: int = 1,
    ):
        self._columns_meta = columns_meta
        self._identity_columns = identity_columns or set()
        self._next_numeric_value = next_numeric_value
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
        elif "SELECT ISNULL(MAX([" in query:
            self._fetchone_result = (self._next_numeric_value,)
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
        self.settings = SimpleNamespace(is_development=False)

    def _connect(self):
        return self._connection


class HistoryAndProcessRulesTests(unittest.TestCase):
    def test_history_insert_generates_numeric_codigo_when_column_is_int(self):
        columns = [
            SimpleNamespace(column_name="Codigo", type_name="int", column_size=4, nullable=False),
            SimpleNamespace(column_name="id_teste", type_name="nvarchar", column_size=120, nullable=False),
            SimpleNamespace(column_name="nome_candidato", type_name="nvarchar", column_size=255, nullable=True),
            SimpleNamespace(column_name="vaga", type_name="nvarchar", column_size=255, nullable=True),
        ]
        cursor = FakeHistoryCursor(columns, next_numeric_value=14)
        conn = FakeHistoryConnection(cursor)
        repository = FakeHistoryRepository(conn)

        with (
            patch("rh_api.repositories.history.ensure_process_reference_columns", lambda _cursor: None),
            patch("rh_api.repositories.history.ensure_decimal_process_columns", lambda _cursor: None),
        ):
            result = repository.save_history(
                {
                    "id_teste": "CV-13",
                    "nome_candidato": "Ana Souza",
                    "vaga": "Analista",
                }
            )

        self.assertEqual(result, {"success": True})
        insert_query, insert_params = cursor.executed[-1]
        self.assertIn("[Codigo]", insert_query)
        self.assertEqual(insert_params[0], 14)
        self.assertEqual(insert_params[1], "CV-13")
        self.assertTrue(conn.committed)

    def test_history_insert_uses_textual_codigo_when_column_is_not_numeric(self):
        columns = [
            SimpleNamespace(column_name="Codigo", type_name="nvarchar", column_size=50, nullable=False),
            SimpleNamespace(column_name="id_teste", type_name="nvarchar", column_size=120, nullable=False),
            SimpleNamespace(column_name="nome_candidato", type_name="nvarchar", column_size=255, nullable=True),
        ]
        cursor = FakeHistoryCursor(columns)
        conn = FakeHistoryConnection(cursor)
        repository = FakeHistoryRepository(conn)

        with (
            patch("rh_api.repositories.history.ensure_process_reference_columns", lambda _cursor: None),
            patch("rh_api.repositories.history.ensure_decimal_process_columns", lambda _cursor: None),
        ):
            repository.save_history(
                {
                    "Codigo": "HIST-123",
                    "id_teste": "TESTE-001",
                    "nome_candidato": "Ana Souza",
                }
            )

        insert_query, insert_params = cursor.executed[-1]
        self.assertIn("[Codigo]", insert_query)
        self.assertEqual(insert_params[0], "HIST-123")

    def test_history_insert_omits_codigo_when_column_is_identity(self):
        columns = [
            SimpleNamespace(column_name="Codigo", type_name="int", column_size=4, nullable=False),
            SimpleNamespace(column_name="id_teste", type_name="nvarchar", column_size=120, nullable=False),
            SimpleNamespace(column_name="nome_candidato", type_name="nvarchar", column_size=255, nullable=True),
        ]
        cursor = FakeHistoryCursor(columns, identity_columns={"Codigo"})
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
        self.assertNotIn("[CÃ³digo]", insert_query)
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

    def test_interview_update_schema_accepts_reschedule_status(self):
        payload = InterviewUpdateRequest(status_entrevista="Reagendado")
        self.assertEqual(payload.status_entrevista, "Reagendado")

    def test_interview_slot_schema_validates_minimum_duration(self):
        payload = InterviewSlotCreateRequest(
            data="2026-05-01",
            hora_inicio="09:00",
            hora_fim="10:00",
            duracao_minutos=30,
        )
        self.assertEqual(payload.duracao_minutos, 30)


if __name__ == "__main__":
    unittest.main()
