from __future__ import annotations

import sys
import unittest
from pathlib import Path

API_DIR = Path(__file__).resolve().parents[1]
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from rh_api.repositories.analytics import AnalyticsRepositoryMixin
from rh_api.routers.analytics import get_funnel_dashboard


class FakeFunnelCursor:
    """Cursor mínimo: só reconhece o SELECT usado por get_funnel_dashboard.
    Comandos DDL dos `ensure_*` de bootstrap são aceitos e ignorados."""

    _COLUMNS = [
        "id_registro",
        "id_processo",
        "id_processo_ref",
        "status_candidato",
        "etapa_pipeline",
        "origem",
        "data_prova",
        "aprovado_em",
    ]

    def __init__(self, rows: list[tuple]):
        self._rows = rows
        self.description = []
        self._current_rows: list[tuple] = []

    def execute(self, query: str, params=()):
        if "candidatos_processos" in query and "etapa_pipeline" in query:
            self.description = [(column,) for column in self._COLUMNS]
            self._current_rows = self._rows
        else:
            self.description = []
            self._current_rows = []

    def fetchall(self):
        return self._current_rows

    def fetchone(self):
        return (0,)

    def columns(self, table: str = "", schema: str | None = None):
        return []


class FakeFunnelConnection:
    def __init__(self, cursor: FakeFunnelCursor):
        self._cursor = cursor
        self.closed = False

    def cursor(self):
        return self._cursor

    def close(self):
        self.closed = True


class FakeFunnelRepository(AnalyticsRepositoryMixin):
    def __init__(self, cursor: FakeFunnelCursor):
        self._connection = FakeFunnelConnection(cursor)

    def _connect(self):
        return self._connection


# id_registro, id_processo, id_processo_ref, status_candidato, etapa_pipeline, origem, data_prova, aprovado_em
SAMPLE_ROWS = [
    (1, "P1", "P1", "Analise", "Triagem", "Prova", "2026-01-01T09:00:00", None),
    (2, "P1", "P1", "Qualificado", "Prova", "Prova", "2026-01-02T09:00:00", None),
    (3, "P1", "P1", "Agendado", "Entrevista", "Indicação", "2026-01-03T09:00:00", None),
    (4, "P1", "P1", "Aprovado", "Aprovado", "Prova", "2026-01-01T09:00:00", "2026-01-11T09:00:00"),
    (5, "P1", "P1", "Aprovado", "Aprovado", "Indicação", "2026-01-05T09:00:00", "2026-01-10T09:00:00"),
    (6, "P1", "P1", "Eliminado", "Reprovado", "Prova", "2026-01-01T09:00:00", None),
    # Fora do período/processo filtrado nos testes de filtro:
    (7, "P2", "P2", "Aprovado", "Aprovado", "LinkedIn", "2025-01-01T09:00:00", "2025-01-31T09:00:00"),
]


class FunnelDashboardHappyPathTests(unittest.TestCase):
    def test_computes_funnel_time_to_hire_and_origin_breakdown(self):
        cursor = FakeFunnelCursor(SAMPLE_ROWS)
        repository = FakeFunnelRepository(cursor)

        result = repository.get_funnel_dashboard()

        self.assertEqual(result["total_candidatos"], len(SAMPLE_ROWS))
        self.assertEqual(result["total_aprovados_considerados"], 3)

        # Time-to-hire: (10 + 5 + 30) / 3 dias = 15.0
        self.assertEqual(result["time_to_hire_medio_dias"], 15.0)

        etapas_por_nome = {item["etapa"]: item for item in result["funil_etapas"]}
        self.assertEqual(etapas_por_nome["Triagem"]["total"], 1)
        self.assertEqual(etapas_por_nome["Prova"]["total"], 1)
        self.assertEqual(etapas_por_nome["Entrevista"]["total"], 1)
        self.assertEqual(etapas_por_nome["Aprovado"]["total"], 3)
        self.assertEqual(etapas_por_nome["Reprovado"]["total"], 1)
        # 3 aprovados em 7 candidatos totais = 42.9%
        self.assertAlmostEqual(etapas_por_nome["Aprovado"]["percentual_conversao"], round(3 / 7 * 100, 1))

        origem_por_nome = {item["origem"]: item["total"] for item in result["origem_candidatos"]}
        self.assertEqual(origem_por_nome["Prova"], 4)
        self.assertEqual(origem_por_nome["Indicação"], 2)
        self.assertEqual(origem_por_nome["LinkedIn"], 1)

    def test_filters_by_process_id(self):
        cursor = FakeFunnelCursor(SAMPLE_ROWS)
        repository = FakeFunnelRepository(cursor)

        result = repository.get_funnel_dashboard(id_processo="P2")

        self.assertEqual(result["total_candidatos"], 1)
        self.assertEqual(result["total_aprovados_considerados"], 1)
        self.assertEqual(result["time_to_hire_medio_dias"], 30.0)

    def test_filters_by_date_range(self):
        cursor = FakeFunnelCursor(SAMPLE_ROWS)
        repository = FakeFunnelRepository(cursor)

        # Só candidatos com data_prova em 2026 (exclui a linha de P2/2025).
        result = repository.get_funnel_dashboard(start_date="2026-01-01", end_date="2026-01-31")

        self.assertEqual(result["total_candidatos"], 6)

    def test_returns_none_time_to_hire_when_no_approved_candidates(self):
        cursor = FakeFunnelCursor(
            [
                (1, "P3", "P3", "Analise", "Triagem", "Prova", "2026-01-01T09:00:00", None),
            ]
        )
        repository = FakeFunnelRepository(cursor)

        result = repository.get_funnel_dashboard(id_processo="P3")

        self.assertIsNone(result["time_to_hire_medio_dias"])
        self.assertEqual(result["total_aprovados_considerados"], 0)

    def test_router_delegates_to_repository(self):
        cursor = FakeFunnelCursor(SAMPLE_ROWS)
        repository = FakeFunnelRepository(cursor)

        result = get_funnel_dashboard(
            start_date="",
            end_date="",
            id_processo="P1",
            repository=repository,
        )
        self.assertEqual(result["total_candidatos"], 6)


if __name__ == "__main__":
    unittest.main()
