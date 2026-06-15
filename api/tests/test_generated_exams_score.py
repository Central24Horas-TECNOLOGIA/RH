from __future__ import annotations

import re
import sys
import unittest
from pathlib import Path

API_DIR = Path(__file__).resolve().parents[1]
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from rh_api.routers.generated_exams import (
    create_generated_exam,
    public_access_code,
    public_access_email,
    public_finalize_exam,
)
from rh_api.repositories.generated_exams import _is_public_answer_complete
from rh_api.schemas.generated_exams import (
    GeneratedExamCreateRequest,
    PublicExamAccessRequest,
    PublicExamAnswersRequest,
)
from rh_api.services.score_conecta import calcular_score_conecta


class FakeGeneratedExamRepository:
    def __init__(self):
        self.created_payloads: list[dict] = []
        self.generated_by = ""
        self.finalized_payloads: list[dict] = []

    def create_generated_exam(self, data: dict, *, generated_by: str = ""):
        self.created_payloads.append(data)
        self.generated_by = generated_by
        return {
            "success": True,
            "id_prova": 7,
            "id_teste": data.get("id_teste") or "CP-TESTE",
            "codigo_acesso": "AB12",
            "link_publico": "/conecta-provas",
            "status": "Disponível",
        }

    def public_access_by_email(self, email: str):
        return {
            "success": True,
            "provas": [
                {
                    "token": "token-publico",
                    "vaga": "Analista",
                    "operacao": "CRF",
                    "status": "Disponível",
                }
            ],
        }

    def public_access_by_code(self, code: str):
        return {
            "success": bool(re.fullmatch(r"[A-Z]{2}\d{2}", code)),
            "provas": [{"token": "token-publico"}] if re.fullmatch(r"[A-Z]{2}\d{2}", code) else [],
        }

    def public_finalize_exam(self, data: dict):
        self.finalized_payloads.append(data)
        return {
            "success": True,
            "status": "Finalizada",
            "pendente_avaliacao_manual": False,
        }


class GeneratedExamsAndScoreTests(unittest.TestCase):
    def test_score_uses_weights_and_blocks_missing_required_stage(self):
        score = calcular_score_conecta(
            candidato={"score_curriculo": 82},
            prova={
                "vaga": "Estagiário",
                "trilha": "RH",
                "nivel": "2",
                "etapas": [{"key": "professional_essay", "label": "Redação"}],
                "resultado": {
                    "nota_objetiva": 88,
                    "nota_redacao": None,
                    "score_por_categoria": {"Português": 88},
                },
            },
            processo={},
            configuracao={"redacao_obrigatoria": True},
        )

        self.assertEqual(score["classificacao"], "Pendente de avaliação")
        self.assertIn("Redação corrigida", score["dados_ausentes"])
        self.assertEqual(score["confiabilidade"], "Incompleta")

    def test_score_applies_technical_lock(self):
        score = calcular_score_conecta(
            candidato={"score_curriculo": 90},
            prova={
                "vaga": "Suporte Técnico Pleno",
                "trilha": "TI",
                "nivel": "3",
                "resultado": {
                    "nota_objetiva": 92,
                    "nota_tecnica": 42,
                    "nota_entrevista": 90,
                    "score_por_categoria": {"Conhecimento técnico": 42},
                },
            },
            processo={},
            configuracao={},
        )

        self.assertNotEqual(score["classificacao"], "Forte indicação")
        self.assertIn(
            "Desempenho técnico abaixo do mínimo recomendado para a vaga.",
            score["alertas_criticos"],
        )

    def test_generated_exam_router_forwards_create_payload(self):
        repository = FakeGeneratedExamRepository()
        payload = GeneratedExamCreateRequest(
            nome_candidato="Ana Souza",
            email="ana@example.com",
            telefone="21999999999",
            vaga="Analista",
            area_prova="ADM / Gestão",
            operacao="CRF",
            trilha="adm",
            nivel="4",
            tempo_total=40,
            questoes_snapshot=[
                {
                    "type": "multiple",
                    "title": "Q1",
                    "description": "Pergunta",
                    "options": ["A", "B"],
                    "answer": 0,
                    "points": 10,
                }
            ],
        )

        user = type("User", (), {"nome": "RH Local", "usuario": "rh", "email": "", "has_permission": lambda *_: True})()
        request = type("Request", (), {"client": None, "headers": {}, "method": "POST", "url": type("Url", (), {"path": "/generated-exams"})()})()
        result = create_generated_exam(payload, request=request, user=user, repository=repository)

        self.assertTrue(result["success"])
        self.assertRegex(result["codigo_acesso"], r"^[A-Z]{2}\d{2}$")
        self.assertEqual(repository.created_payloads[0]["nome_candidato"], "Ana Souza")
        self.assertEqual(repository.generated_by, "RH Local")

    def test_public_required_answer_validation_handles_rich_text_and_excel(self):
        self.assertFalse(
            _is_public_answer_complete(
                {"type": "word"},
                {"type": "word", "content": "<p><br></p>", "text": ""},
            )
        )
        self.assertTrue(
            _is_public_answer_complete(
                {"type": "word"},
                {"type": "word", "content": "<p>Resposta organizada.</p>"},
            )
        )
        self.assertFalse(
            _is_public_answer_complete(
                {"type": "excel_external"},
                {"type": "excel_external", "filename": "", "contentBase64": "abc"},
            )
        )
        self.assertTrue(
            _is_public_answer_complete(
                {"type": "excel_external"},
                {
                    "type": "excel_external",
                    "filename": "ana.xlsx",
                    "contentBase64": "abc",
                },
            )
        )

    def test_public_access_and_finalize_do_not_require_rh_user(self):
        repository = FakeGeneratedExamRepository()

        access = public_access_email(
            PublicExamAccessRequest(email="ana@example.com"),
            repository=repository,
        )
        code_access = public_access_code(
            PublicExamAccessRequest(codigo="AB12"),
            repository=repository,
        )
        finalized = public_finalize_exam(
            PublicExamAnswersRequest(
                token="token-publico",
                respostas=[{"selected": 0}],
                finalizar_mesmo_assim=True,
            ),
            repository=repository,
        )

        self.assertTrue(access["success"])
        self.assertTrue(code_access["success"])
        self.assertEqual(finalized["status"], "Finalizada")
        self.assertEqual(repository.finalized_payloads[0]["token"], "token-publico")
        self.assertTrue(repository.finalized_payloads[0]["finalizar_mesmo_assim"])


if __name__ == "__main__":
    unittest.main()
