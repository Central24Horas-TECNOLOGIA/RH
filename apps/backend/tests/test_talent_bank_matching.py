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

from rh_api.repositories.talent_bank import TalentBankRepositoryMixin, _extract_matching_keywords
from rh_api.routers.processes import get_process_suggested_candidates


class FakeMatchingCursor:
    """Cursor mínimo que reconhece só as consultas usadas pelo motor de
    matching (get_talent_bank_matches). Comandos DDL dos `ensure_*` de
    bootstrap são aceitos e ignorados (não afetam o teste)."""

    def __init__(self, *, banco_talentos_rows, vinculados_rows, scorecards_rows, etapas_rows):
        self._responses = [
            ("FROM banco_talentos", ["id_banco", "id_teste", "nome_candidato", "vaga", "pontuacao_final", "origem", "data_movimentacao"], banco_talentos_rows),
            ("WHERE id_processo = ? OR id_processo_ref = ?", ["id_teste", "id_processo", "id_processo_ref"], vinculados_rows),
            ("AVG(CAST(s.nota AS FLOAT))", ["id_teste", "media"], scorecards_rows),
            ("SELECT id_teste, vaga, etapa_pipeline", ["id_teste", "vaga", "etapa_pipeline"], etapas_rows),
        ]
        self.description = []
        self._current_rows: list[tuple] = []
        self.executed: list[str] = []

    def execute(self, query: str, params=()):
        self.executed.append(query)
        for marker, columns, rows in self._responses:
            if marker in query:
                self.description = [(column,) for column in columns]
                self._current_rows = rows
                return
        # Comando DDL de bootstrap (ensure_*): nada para retornar.
        self.description = []
        self._current_rows = []

    def fetchall(self):
        return self._current_rows

    def fetchone(self):
        # Usado pelos `ensure_*` de bootstrap (ex. checagem de IDENTITY).
        # Nenhum teste depende do valor retornado aqui.
        return (0,)

    def columns(self, table: str = "", schema: str | None = None):
        return []


class FakeMatchingConnection:
    def __init__(self, cursor: FakeMatchingCursor):
        self._cursor = cursor
        self.closed = False

    def cursor(self):
        return self._cursor

    def close(self):
        self.closed = True


class FakeMatchingRepository(TalentBankRepositoryMixin):
    def __init__(self, cursor: FakeMatchingCursor, profile_map: dict):
        self._connection = FakeMatchingConnection(cursor)
        self._profile_map = profile_map

    def _connect(self):
        return self._connection

    def _get_candidate_profile_map(self, cursor):
        return self._profile_map


FAKE_PROCESS_ROW = {
    "id_processo": "PROC1",
    "id_processo_ref": "PROC1",
    "vaga": "Analista de Logística",
    "operacao": "Operações",
    "trilha": "Administrativo",
    "requisitos_publicos": "Conhecimento em Excel avançado e rotinas de logística",
    "responsabilidades_publicas": "",
}


class KeywordExtractionTests(unittest.TestCase):
    def test_extracts_normalized_keywords_and_drops_stopwords(self):
        keywords = _extract_matching_keywords("Analista de Logística e Excel avançado")
        self.assertIn("analista", keywords)
        self.assertIn("logistica", keywords)
        self.assertIn("excel", keywords)
        self.assertIn("avancado", keywords)
        # stopwords/preposições não entram
        self.assertNotIn("de", keywords)
        self.assertNotIn("e", keywords)

    def test_ignores_short_tokens(self):
        keywords = _extract_matching_keywords("um rh de ti")
        self.assertEqual(keywords, set())


class TalentBankMatchingHappyPathTests(unittest.TestCase):
    @patch("rh_api.repositories.talent_bank.get_process_row", return_value=FAKE_PROCESS_ROW)
    def test_matches_candidates_by_keyword_overlap_and_excludes_linked(self, _mock_get_process_row):
        cursor = FakeMatchingCursor(
            banco_talentos_rows=[
                (1, "T1", "Ana Souza", "Assistente de Logística", "8.5", "Processo Unico", "2026-01-10"),
                (2, "T2", "Bruno Lima", "Recepcionista", "7.0", "Processo Unico", "2026-02-01"),
                (3, "T3", "Carla Dias", "Analista de Logística", "9.0", "Indicação", "2026-03-01"),
            ],
            vinculados_rows=[("T3", "PROC1", "PROC1")],
            scorecards_rows=[("T1", 4.2)],
            etapas_rows=[("T1", "Assistente de Logística", "Entrevista")],
        )
        profile_map = {
            "T1": {"habilidades": ["excel", "logística"], "tags": [], "observacao_rh": ""},
            "T2": {"habilidades": ["atendimento"], "tags": [], "observacao_rh": ""},
        }
        repository = FakeMatchingRepository(cursor, profile_map)

        result = repository.get_talent_bank_matches("PROC1")

        self.assertEqual(result["id_processo"], "PROC1")
        self.assertEqual(result["total_sugestoes"], 1)
        candidatos_ids = [item["id_teste"] for item in result["candidatos"]]
        # T1: tem palavras em comum (logistica/excel) -> sugerido
        self.assertIn("T1", candidatos_ids)
        # T2: nenhuma palavra em comum -> não sugerido
        self.assertNotIn("T2", candidatos_ids)
        # T3: já vinculado ao processo destino -> não sugerido mesmo com match forte
        self.assertNotIn("T3", candidatos_ids)

        sugestao_t1 = result["candidatos"][0]
        self.assertEqual(sugestao_t1["scorecard_medio"], 4.2)
        self.assertIn("Scorecard médio 4.2", sugestao_t1["motivo"])
        self.assertIn("entrevista", sugestao_t1["motivo"].lower())
        self.assertGreater(len(sugestao_t1["palavras_em_comum"]), 0)

    @patch("rh_api.repositories.talent_bank.get_process_row", return_value=None)
    def test_raises_404_when_process_not_found(self, _mock_get_process_row):
        cursor = FakeMatchingCursor(banco_talentos_rows=[], vinculados_rows=[], scorecards_rows=[], etapas_rows=[])
        repository = FakeMatchingRepository(cursor, {})
        with pytest.raises(HTTPException) as exc_info:
            repository.get_talent_bank_matches("INEXISTENTE")
        self.assertEqual(exc_info.value.status_code, 404)

    @patch("rh_api.repositories.talent_bank.get_process_row", return_value=FAKE_PROCESS_ROW)
    def test_router_delegates_to_repository(self, _mock_get_process_row):
        cursor = FakeMatchingCursor(
            banco_talentos_rows=[(1, "T1", "Ana Souza", "Assistente de Logística", "8.5", "Processo Unico", "2026-01-10")],
            vinculados_rows=[],
            scorecards_rows=[],
            etapas_rows=[],
        )
        profile_map = {"T1": {"habilidades": ["logistica"], "tags": [], "observacao_rh": ""}}
        repository = FakeMatchingRepository(cursor, profile_map)

        result = get_process_suggested_candidates("PROC1", limit=15, repository=repository)
        self.assertEqual(result["total_sugestoes"], 1)
        self.assertEqual(result["candidatos"][0]["id_teste"], "T1")


if __name__ == "__main__":
    unittest.main()
