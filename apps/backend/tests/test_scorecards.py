from __future__ import annotations

import sys
import unittest
from copy import deepcopy
from pathlib import Path

import pytest

API_DIR = Path(__file__).resolve().parents[1]
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from fastapi import HTTPException

from rh_api.repositories.scorecards import (
    NOTA_MAXIMA,
    NOTA_MINIMA,
    SCORECARD_CRITERIOS_PADRAO,
    ScorecardRepositoryMixin,
)
from rh_api.routers.scorecards import (
    get_candidate_scorecard_history,
    get_scorecard_criterios_padrao,
    save_candidate_scorecard,
)
from rh_api.schemas.scorecards import ScorecardCriterionInput, ScorecardSaveRequest


class FakeScorecardRepository:
    """Repositório em memória usado apenas para exercitar os endpoints."""

    def __init__(self):
        self.candidates = {
            1: {"id_registro": 1, "nome_candidato": "Ana Souza", "status_candidato": "Qualificado"},
        }
        self.rows: list[dict] = []
        self._next_id = 1

    def list_candidate_scorecards(self, id_registro: int) -> list[dict]:
        if int(id_registro) not in self.candidates:
            raise HTTPException(status_code=404, detail="Candidato do processo não encontrado.")
        items = [item for item in self.rows if item["candidato_processo_id"] == int(id_registro)]
        return [deepcopy(item) for item in sorted(items, key=lambda item: -item["id"])]

    def save_candidate_scorecard(self, id_registro: int, data: dict, *, avaliado_por: str = "") -> dict:
        if int(id_registro) not in self.candidates:
            raise HTTPException(status_code=404, detail="Candidato do processo não encontrado.")

        etapa_avaliada = str(data.get("etapa_avaliada") or "").strip()
        criterios = data.get("criterios") or []
        if not criterios:
            raise HTTPException(status_code=400, detail="Informe ao menos um critério avaliado.")

        for item in criterios:
            nota = int(item.get("nota"))
            if nota < NOTA_MINIMA or nota > NOTA_MAXIMA:
                raise HTTPException(status_code=400, detail="Nota fora do intervalo permitido.")

        # Substitui as notas anteriores da mesma etapa (mesmo comportamento do
        # repositório real: registrar de novo = editar).
        self.rows = [
            row
            for row in self.rows
            if not (
                row["candidato_processo_id"] == int(id_registro)
                and row.get("etapa_avaliada") == etapa_avaliada
            )
        ]

        salvos = []
        for item in criterios:
            self._next_id += 1
            row = {
                "id": self._next_id,
                "candidato_processo_id": int(id_registro),
                "etapa_avaliada": etapa_avaliada,
                "criterio": str(item.get("criterio")),
                "nota": int(item.get("nota")),
                "comentario": str(item.get("comentario") or ""),
                "avaliado_por": avaliado_por,
                "avaliado_em": "2026-08-24T10:00:00",
            }
            self.rows.append(row)
            salvos.append(row)

        return {"success": True, "id_registro": int(id_registro), "etapa_avaliada": etapa_avaliada, "criterios": salvos}


class ScorecardCriteriaConstantsTests(unittest.TestCase):
    def test_default_criteria_has_three_fixed_items(self):
        self.assertEqual(
            SCORECARD_CRITERIOS_PADRAO,
            ["Comunicação", "Fit técnico", "Experiência relevante"],
        )

    def test_score_bounds_are_one_to_five(self):
        self.assertEqual(NOTA_MINIMA, 1)
        self.assertEqual(NOTA_MAXIMA, 5)


class ScorecardRepositoryMixinValidationTests(unittest.TestCase):
    class _FakeConn:
        def __init__(self):
            self.committed = False

        def cursor(self):
            raise AssertionError("Não deveria chegar ao banco quando a validação falha antes.")

        def close(self):
            pass

    class _Repo(ScorecardRepositoryMixin):
        def _connect(self):
            return ScorecardRepositoryMixinValidationTests._FakeConn()

    def test_save_scorecard_rejects_empty_criteria_before_touching_db(self):
        repo = self._Repo()
        with pytest.raises(HTTPException) as exc_info:
            repo.save_candidate_scorecard(1, {"etapa_avaliada": "Entrevista", "criterios": []})
        self.assertEqual(exc_info.value.status_code, 400)

    def test_save_scorecard_rejects_note_out_of_bounds(self):
        repo = self._Repo()
        with pytest.raises(HTTPException) as exc_info:
            repo.save_candidate_scorecard(
                1,
                {
                    "etapa_avaliada": "Entrevista",
                    "criterios": [{"criterio": "Comunicação", "nota": 9}],
                },
            )
        self.assertEqual(exc_info.value.status_code, 400)


class ScorecardApiHappyPathTests(unittest.TestCase):
    def test_criterios_padrao_endpoint_returns_fixed_list(self):
        payload = get_scorecard_criterios_padrao()
        self.assertEqual(payload["criterios"], SCORECARD_CRITERIOS_PADRAO)

    def test_save_then_read_scorecard_history(self):
        repository = FakeScorecardRepository()

        request = ScorecardSaveRequest(
            etapa_avaliada="Entrevista",
            criterios=[
                ScorecardCriterionInput(criterio="Comunicação", nota=4, comentario="Boa comunicação"),
                ScorecardCriterionInput(criterio="Fit técnico", nota=5, comentario=""),
                ScorecardCriterionInput(criterio="Experiência relevante", nota=3, comentario=""),
            ],
        )

        response = save_candidate_scorecard(1, request, repository=repository)
        self.assertTrue(response["success"])
        self.assertEqual(len(response["criterios"]), 3)

        historico = get_candidate_scorecard_history(1, repository=repository)
        self.assertEqual(len(historico), 3)
        notas = {item["criterio"]: item["nota"] for item in historico}
        self.assertEqual(notas["Comunicação"], 4)
        self.assertEqual(notas["Fit técnico"], 5)
        self.assertEqual(notas["Experiência relevante"], 3)

    def test_saving_again_for_same_stage_replaces_previous_scores(self):
        repository = FakeScorecardRepository()

        save_candidate_scorecard(
            1,
            ScorecardSaveRequest(
                etapa_avaliada="Entrevista",
                criterios=[ScorecardCriterionInput(criterio="Comunicação", nota=2)],
            ),
            repository=repository,
        )
        save_candidate_scorecard(
            1,
            ScorecardSaveRequest(
                etapa_avaliada="Entrevista",
                criterios=[ScorecardCriterionInput(criterio="Comunicação", nota=5)],
            ),
            repository=repository,
        )

        historico = get_candidate_scorecard_history(1, repository=repository)
        self.assertEqual(len(historico), 1)
        self.assertEqual(historico[0]["nota"], 5)

    def test_save_scorecard_for_unknown_candidate_returns_404(self):
        repository = FakeScorecardRepository()
        with pytest.raises(HTTPException) as exc_info:
            save_candidate_scorecard(
                999,
                ScorecardSaveRequest(
                    etapa_avaliada="Entrevista",
                    criterios=[ScorecardCriterionInput(criterio="Comunicação", nota=3)],
                ),
                repository=repository,
            )
        self.assertEqual(exc_info.value.status_code, 404)


if __name__ == "__main__":
    unittest.main()
