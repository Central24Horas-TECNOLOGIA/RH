from __future__ import annotations

import sys
import unittest
from pathlib import Path

import pytest

API_DIR = Path(__file__).resolve().parents[1]
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from fastapi import HTTPException

from rh_api.repositories.processes import LIMITE_PERCENTUAL_VAGAS_URGENTES, ProcessRepositoryMixin


class FakeUrgentCursor:
    """Cursor mínimo que só sabe responder ao SELECT usado por
    _count_open_and_urgent_processes (id_processo, status, urgente)."""

    def __init__(self, rows: list[tuple]):
        self._rows = rows
        self.description = [("id_processo",), ("status",), ("urgente",)]

    def execute(self, query: str, params=()):
        return None

    def fetchall(self):
        return self._rows


class UrgentProcessQuotaTests(unittest.TestCase):
    def test_quota_constant_is_twenty_percent(self):
        self.assertEqual(LIMITE_PERCENTUAL_VAGAS_URGENTES, 0.2)

    def test_counts_only_open_processes_as_eligible(self):
        cursor = FakeUrgentCursor(
            [
                ("P1", "Aberto", 0),
                ("P2", "Encerrado", 1),  # fechado: não deve contar
                ("P3", "Aberto", 1),
                ("P4", "Pausado", 0),  # pausado: não deve contar
            ]
        )
        total_abertas, total_urgentes = ProcessRepositoryMixin._count_open_and_urgent_processes(cursor)
        self.assertEqual(total_abertas, 2)
        self.assertEqual(total_urgentes, 1)

    def test_allows_marking_urgent_when_within_quota(self):
        # 4 vagas abertas hoje, nenhuma urgente. Marcar a 5a (nova) como
        # urgente resulta em 1/5 = 20%, dentro do limite -> permitido.
        cursor = FakeUrgentCursor(
            [
                ("P1", "Aberto", 0),
                ("P2", "Aberto", 0),
                ("P3", "Aberto", 0),
                ("P4", "Aberto", 0),
            ]
        )
        # Não deve lançar exceção.
        ProcessRepositoryMixin._assert_urgent_quota_available(cursor)

    def test_blocks_marking_urgent_when_quota_would_be_exceeded(self):
        # Só 2 vagas abertas hoje: marcar mais uma urgente daria 1/3 = 33%,
        # acima do limite de 20% -> deve bloquear com mensagem clara.
        cursor = FakeUrgentCursor(
            [
                ("P1", "Aberto", 0),
                ("P2", "Aberto", 0),
            ]
        )
        with pytest.raises(HTTPException) as exc_info:
            ProcessRepositoryMixin._assert_urgent_quota_available(cursor)
        self.assertEqual(exc_info.value.status_code, 400)
        self.assertIn("Limite de vagas urgentes", exc_info.value.detail)
        self.assertIn("20%", exc_info.value.detail)

    def test_excludes_the_process_itself_when_editing(self):
        # Editando P1 (que já está aberta) para marcá-la urgente: P1 não deve
        # ser contada duas vezes na base de comparação.
        cursor = FakeUrgentCursor(
            [
                ("P1", "Aberto", 0),
                ("P2", "Aberto", 0),
                ("P3", "Aberto", 0),
                ("P4", "Aberto", 0),
                ("P5", "Aberto", 0),
            ]
        )
        ProcessRepositoryMixin._assert_urgent_quota_available(cursor, exclude_process_id="P1")


if __name__ == "__main__":
    unittest.main()
