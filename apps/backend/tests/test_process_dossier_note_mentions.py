from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch

API_DIR = Path(__file__).resolve().parents[1]
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from rh_api.repositories.processes import (
    ProcessRepositoryMixin,
    attach_note_mentions,
    extract_note_mentions,
)


def test_extract_note_mentions_finds_unique_handles_in_order():
    texto = "Combinar com @joana.silva e @carlos antes da entrevista. Avisar @joana.silva de novo."

    assert extract_note_mentions(texto) == ["joana.silva", "carlos"]


def test_extract_note_mentions_ignores_emails_and_returns_empty_for_blank_text():
    assert extract_note_mentions("Contato: candidato@empresa.com") == []
    assert extract_note_mentions("") == []
    assert extract_note_mentions(None) == []


def test_attach_note_mentions_parses_json_and_drops_raw_column():
    rows = [
        {"id_anotacao": 1, "mencoes_json": '["ana", "bruno"]'},
        {"id_anotacao": 2, "mencoes_json": None},
        {"id_anotacao": 3, "mencoes_json": "not-json"},
    ]

    result = attach_note_mentions(rows)

    assert result[0]["mencoes"] == ["ana", "bruno"]
    assert "mencoes_json" not in result[0]
    assert result[1]["mencoes"] == []
    assert result[2]["mencoes"] == []


class FakeCursor:
    def __init__(self, note_row: tuple):
        self._note_row = note_row
        self.executed: list[str] = []
        self.description = []
        self._pending: list[tuple] = []

    def execute(self, query: str, params=()):
        self.executed.append(query)
        self._last_params = params
        if "FROM processos_seletivos" in query or "processos_seletivos" in query.lower():
            self.description = []
            self._pending = []
            return
        if "SELECT" in query and "FROM processos_dossie_anotacoes" in query:
            self.description = [
                (col,)
                for col in (
                    "id_anotacao", "id_processo", "id_processo_ref", "id_teste",
                    "nome_candidato", "texto", "usuario_responsavel",
                    "criado_em", "atualizado_em", "mencoes_json",
                )
            ]
            self._pending = [self._note_row]
            return
        self.description = []
        self._pending = []

    def fetchall(self):
        return self._pending

    def fetchone(self):
        if "OUTPUT INSERTED.id_anotacao" in (self.executed[-1] if self.executed else ""):
            return (self._note_row[0],)
        return self._pending[0] if self._pending else None

    def columns(self, table: str = "", schema: str | None = None):
        return []


class FakeConnection:
    def __init__(self, cursor: FakeCursor):
        self._cursor = cursor
        self.committed = False

    def cursor(self):
        return self._cursor

    def commit(self):
        self.committed = True

    def close(self):
        pass


class FakeRepository(ProcessRepositoryMixin):
    def __init__(self, cursor: FakeCursor):
        self._connection = FakeConnection(cursor)

    def _connect(self):
        return self._connection


FAKE_PROCESS_ROW = {"id_processo": "PROC1", "id_processo_ref": "PROC1", "status": "Aberto"}


@patch("rh_api.repositories.processes.get_process_row", return_value=FAKE_PROCESS_ROW)
def test_create_process_dossier_note_stores_extracted_mentions(_mock_get_process_row):
    note_row = (
        1, "PROC1", "PROC1", "", "", "Alinhar com @ana.rh sobre a vaga.",
        "rh.usuario", "2026-08-20T10:00:00", "2026-08-20T10:00:00", '["ana.rh"]',
    )
    cursor = FakeCursor(note_row)
    repository = FakeRepository(cursor)

    result = repository.create_process_dossier_note(
        "PROC1",
        {"texto": "Alinhar com @ana.rh sobre a vaga."},
        usuario_responsavel="rh.usuario",
    )

    insert_calls = [q for q in cursor.executed if "INSERT INTO processos_dossie_anotacoes" in q]
    assert len(insert_calls) == 1
    assert "mencoes_json" in insert_calls[0]
    assert result["mencoes"] == ["ana.rh"]
    assert "mencoes_json" not in result
