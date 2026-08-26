from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import pytest

API_DIR = Path(__file__).resolve().parents[1]
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from fastapi import HTTPException

from rh_api.repositories.base import BaseRepository
from rh_api.repositories.processes import ProcessRepositoryMixin


class FakeCursor:
    """Cursor mínimo para reconsider_candidate_elimination: reconhece o SELECT
    de candidatos_processos e aceita qualquer UPDATE/INSERT/DDL sem validar."""

    def __init__(self, candidate_row: tuple | None):
        self._candidate_row = candidate_row
        self._pending: list[tuple] = []
        self.description = []
        self.executed: list[str] = []

    def execute(self, query: str, params=()):
        self.executed.append(query)
        if "SELECT" in query and "FROM candidatos_processos" in query and "WHERE id_registro" in query:
            self.description = [
                (col,)
                for col in (
                    "id_registro", "id_processo", "id_processo_ref", "id_teste",
                    "nome_candidato", "vaga", "status_candidato", "origem",
                )
            ]
            self._pending = [self._candidate_row] if self._candidate_row else []
            return
        self.description = []
        self._pending = []

    def fetchall(self):
        return self._pending

    def fetchone(self):
        return (0,)

    def columns(self, table: str = "", schema: str | None = None):
        return []


class FakeConnection:
    def __init__(self, cursor: FakeCursor):
        self._cursor = cursor
        self.committed = False
        self.closed = False

    def cursor(self):
        return self._cursor

    def commit(self):
        self.committed = True

    def close(self):
        self.closed = True


class FakeRepository(ProcessRepositoryMixin, BaseRepository):
    """Herda BaseRepository só pelo _record_candidate_movement real (evita
    reimplementar o INSERT em candidatos_movimentacoes no fake); __init__
    do BaseRepository nunca é chamado, então settings/conexão real não
    entram em jogo."""

    def __init__(self, cursor: FakeCursor):
        self._connection = FakeConnection(cursor)

    def _connect(self):
        return self._connection


FAKE_PROCESS_ROW = {"id_processo": "PROC1", "id_processo_ref": "PROC1", "status": "Aberto"}


class ReconsiderCandidateEliminationTests(unittest.TestCase):
    @patch("rh_api.repositories.processes.get_process_row", return_value=FAKE_PROCESS_ROW)
    def test_reverts_eliminated_candidate_back_to_analise(self, _mock_get_process_row):
        cursor = FakeCursor((10, "PROC1", "PROC1", "T1", "Ana Souza", "Analista", "Eliminado", "Processo Unico"))
        repository = FakeRepository(cursor)

        result = repository.reconsider_candidate_elimination(
            10, "Reavaliação solicitada pelo gestor após revisão do currículo.", actor="rh.usuario"
        )

        self.assertEqual(result, {"success": True})
        update_queries = [q for q in cursor.executed if "UPDATE candidatos_processos" in q]
        self.assertEqual(len(update_queries), 1)
        movement_queries = [q for q in cursor.executed if "INSERT INTO candidatos_movimentacoes" in q]
        self.assertEqual(len(movement_queries), 1)
        self.assertTrue(repository._connection.committed)

    def test_rejects_short_justification_before_touching_db(self):
        cursor = FakeCursor(None)
        repository = FakeRepository(cursor)

        with pytest.raises(HTTPException) as exc_info:
            repository.reconsider_candidate_elimination(10, "curto", actor="rh.usuario")

        self.assertEqual(exc_info.value.status_code, 400)
        self.assertEqual(cursor.executed, [])

    @patch("rh_api.repositories.processes.get_process_row", return_value=FAKE_PROCESS_ROW)
    def test_rejects_candidate_that_is_not_eliminated(self, _mock_get_process_row):
        cursor = FakeCursor((10, "PROC1", "PROC1", "T1", "Ana Souza", "Analista", "Aprovado", "Processo Unico"))
        repository = FakeRepository(cursor)

        with pytest.raises(HTTPException) as exc_info:
            repository.reconsider_candidate_elimination(
                10, "Justificativa qualquer com mais de dez caracteres.", actor="rh.usuario"
            )

        self.assertEqual(exc_info.value.status_code, 409)

    @patch("rh_api.repositories.processes.get_process_row", return_value=None)
    def test_raises_404_when_candidate_not_found(self, _mock_get_process_row):
        cursor = FakeCursor(None)
        repository = FakeRepository(cursor)

        with pytest.raises(HTTPException) as exc_info:
            repository.reconsider_candidate_elimination(
                999, "Justificativa qualquer com mais de dez caracteres.", actor="rh.usuario"
            )

        self.assertEqual(exc_info.value.status_code, 404)

    @patch("rh_api.repositories.processes.get_process_row", return_value={"id_processo": "PROC1", "status": "Encerrado"})
    def test_rejects_reconsideration_when_process_is_closed(self, _mock_get_process_row):
        cursor = FakeCursor((10, "PROC1", "PROC1", "T1", "Ana Souza", "Analista", "Eliminado", "Processo Unico"))
        repository = FakeRepository(cursor)

        with pytest.raises(HTTPException) as exc_info:
            repository.reconsider_candidate_elimination(
                10, "Justificativa qualquer com mais de dez caracteres.", actor="rh.usuario"
            )

        self.assertEqual(exc_info.value.status_code, 409)


if __name__ == "__main__":
    unittest.main()
