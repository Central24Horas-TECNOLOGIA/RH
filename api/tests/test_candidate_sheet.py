from __future__ import annotations

import sys
from pathlib import Path

import pytest
from pydantic import ValidationError


API_DIR = Path(__file__).resolve().parents[1]
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from rh_api.routers.processes import get_candidate_sheet, update_candidate_sheet
from rh_api.schemas.processes import CandidateSheetUpdateRequest


class FakeCandidateSheetRepository:
    def __init__(self):
        self.updated_payload = None
        self.updated_id = ""

    def get_candidate_sheet(self, id_teste: str) -> dict:
        return {
            "success": True,
            "candidato": {"id_teste": id_teste, "nome_candidato": "Ana Souza"},
            "processos": [],
            "resultados": [],
            "avaliacao_rh": {
                "observacoes": "",
                "classificacao": "",
                "classificacao_label": "Não definido",
                "justificativa": "",
            },
        }

    def update_candidate_sheet(self, id_teste: str, data: dict) -> dict:
        self.updated_id = id_teste
        self.updated_payload = data
        response = self.get_candidate_sheet(id_teste)
        response["avaliacao_rh"] = {
            "observacoes": data.get("observacao_rh", ""),
            "classificacao": data.get("classificacao", ""),
            "classificacao_label": data.get("classificacao") or "Não definido",
            "justificativa": data.get("justificativa", ""),
        }
        return response


def test_get_candidate_sheet_returns_repository_payload():
    repository = FakeCandidateSheetRepository()

    payload = get_candidate_sheet("TESTE-001", repository=repository)

    assert payload["success"] is True
    assert payload["candidato"]["id_teste"] == "TESTE-001"
    assert payload["avaliacao_rh"]["classificacao_label"] == "Não definido"


def test_update_candidate_sheet_sends_only_provided_fields():
    repository = FakeCandidateSheetRepository()
    request = CandidateSheetUpdateRequest(
        observacao_rh="Boa comunicação.",
        classificacao="Indicado",
    )

    payload = update_candidate_sheet("TESTE-001", request, repository=repository)

    assert repository.updated_id == "TESTE-001"
    assert repository.updated_payload == {
        "observacao_rh": "Boa comunicação.",
        "classificacao": "Indicado",
    }
    assert payload["avaliacao_rh"]["classificacao"] == "Indicado"


def test_candidate_sheet_rejects_invalid_recommendation():
    with pytest.raises(ValidationError):
        CandidateSheetUpdateRequest(classificacao="Talvez indicar")
