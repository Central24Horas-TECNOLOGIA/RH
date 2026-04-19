from __future__ import annotations

import os
import sys
import unittest
from copy import deepcopy
from pathlib import Path

from fastapi import HTTPException

API_DIR = Path(__file__).resolve().parents[1]
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from rh_api.auth import validate_access_token
from rh_api.config import get_settings
from rh_api.dependencies import get_current_user
from rh_api.routers.auth import login, me
from rh_api.routers.history import get_history
from rh_api.routers.pipeline import (
    create_candidate_pipeline_card,
    get_candidate_pipeline,
    move_candidate_pipeline_card,
)
from rh_api.schemas.auth import LoginRequest
from rh_api.schemas.pipeline import PipelineCardCreateRequest, PipelineCardMoveRequest
from rh_api.services.pipeline import map_pipeline_stage_to_status, normalize_pipeline_stage


class FakeRepository:
    def __init__(self):
        self.history_calls: list[dict] = []
        self.pipeline_cards: list[dict] = []

    def list_history(
        self,
        page: int | None = None,
        page_size: int = 10,
        nome: str = "",
        vaga: str = "",
        data: str = "",
    ):
        self.history_calls.append(
            {
                "page": page,
                "page_size": page_size,
                "nome": nome,
                "vaga": vaga,
                "data": data,
            }
        )

        if page is None and not nome and not vaga and not data:
            return []

        return {
            "items": [
                {
                    "id_teste": "TESTE-001",
                    "id_processo": "PROC.ANL.001",
                    "nome_candidato": nome or "Ana Souza",
                    "vaga": vaga or "Analista",
                    "data_iso": data or "2026-04-18T10:00:00",
                    "status": "Finalizado",
                }
            ],
            "page": page or 1,
            "page_size": page_size,
            "total_items": 1,
            "total_pages": 1,
        }

    def list_pipeline_cards(self, id_processo: str = "", search: str = "") -> list[dict]:
        processo = str(id_processo or "").strip().lower()
        termo = str(search or "").strip().lower()
        cards = self.pipeline_cards

        if processo:
            cards = [item for item in cards if str(item.get("id_processo", "")).strip().lower() == processo]

        if termo:
            cards = [
                item
                for item in cards
                if termo in str(item.get("nome_candidato", "")).lower()
                or termo in str(item.get("vaga", "")).lower()
                or termo in str(item.get("id_processo", "")).lower()
            ]

        return [deepcopy(item) for item in cards]

    def create_pipeline_candidate(self, data: dict) -> dict:
        stage = normalize_pipeline_stage(data.get("etapa_pipeline"))
        id_registro = max((int(item["id_registro"]) for item in self.pipeline_cards), default=0) + 1
        card = {
            "id_registro": id_registro,
            "id_processo": data["id_processo"],
            "id_teste": data.get("id_teste") or f"PIPE-{id_registro:03d}",
            "nome_candidato": data["nome_candidato"],
            "vaga": data.get("vaga") or "Analista",
            "status_candidato": map_pipeline_stage_to_status(stage),
            "pontuacao_final": data.get("pontuacao_final") or "",
            "data_prova": data.get("data_prova") or "2026-04-18T10:00:00",
            "origem": data.get("origem") or "Pipeline manual",
            "etapa_pipeline": stage,
            "data_atualizacao_pipeline": "2026-04-18T10:00:00",
            "status_processo": "Aberto",
        }
        self.pipeline_cards.append(card)
        return {"success": True, "id_registro": id_registro}

    def move_pipeline_card(self, id_registro: int, data: dict) -> dict:
        stage = normalize_pipeline_stage(data.get("etapa_pipeline"))

        for item in self.pipeline_cards:
            if int(item["id_registro"]) != int(id_registro):
                continue

            item["etapa_pipeline"] = stage
            item["status_candidato"] = map_pipeline_stage_to_status(stage, item.get("status_candidato"))
            item["data_atualizacao_pipeline"] = data.get("data_movimentacao") or "2026-04-18T11:00:00"
            return {"success": True}

        raise HTTPException(status_code=404, detail="Card do pipeline nao encontrado.")


class AuthAndPipelineApiTests(unittest.TestCase):
    def setUp(self):
        self.env_keys = (
            "RH_APP_ENV",
            "RH_AUTH_USER",
            "RH_AUTH_PASSWORD",
            "RH_AUTH_TOKEN_SECRET",
        )
        self.original_env = {key: os.environ.get(key) for key in self.env_keys}
        os.environ["RH_APP_ENV"] = "development"
        os.environ["RH_AUTH_USER"] = "rh.local"
        os.environ["RH_AUTH_PASSWORD"] = "senha-segura"
        os.environ["RH_AUTH_TOKEN_SECRET"] = "segredo-de-teste"
        get_settings.cache_clear()

    def tearDown(self):
        for key, value in self.original_env.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        get_settings.cache_clear()

    def test_login_success_and_session_validation(self):
        payload = login(LoginRequest(usuario="rh.local", senha="senha-segura"))

        self.assertEqual(payload.usuario, "rh.local")
        self.assertEqual(payload.token_type, "bearer")
        self.assertTrue(payload.access_token)

        usuario = validate_access_token(payload.access_token)
        me_response = me(user=usuario)
        self.assertEqual(
            me_response.model_dump(),
            {"authenticated": True, "usuario": "rh.local"},
        )

    def test_protected_history_requires_authentication(self):
        with self.assertRaises(HTTPException) as context:
            get_current_user(None)

        self.assertEqual(context.exception.status_code, 401)
        self.assertEqual(context.exception.detail, "Autenticacao obrigatoria.")

    def test_history_uses_server_side_pagination(self):
        repository = FakeRepository()

        payload = get_history(
            page=2,
            page_size=5,
            nome="Ana",
            vaga="",
            data="",
            repository=repository,
        )

        self.assertEqual(payload["page"], 2)
        self.assertEqual(payload["page_size"], 5)
        self.assertEqual(payload["total_items"], 1)
        self.assertEqual(payload["items"][0]["nome_candidato"], "Ana")
        self.assertEqual(
            repository.history_calls[-1],
            {
                "page": 2,
                "page_size": 5,
                "nome": "Ana",
                "vaga": "",
                "data": "",
            },
        )

    def test_pipeline_card_creation_and_move_persist_status(self):
        repository = FakeRepository()
        create_response = create_candidate_pipeline_card(
            PipelineCardCreateRequest(
                id_processo="PROC.ANL.001",
                nome_candidato="Ana Souza",
                vaga="Analista",
                etapa_pipeline="Triagem",
            ),
            repository=repository,
        )

        self.assertTrue(create_response["success"])

        cards = get_candidate_pipeline(id_processo="", search="", repository=repository)
        self.assertEqual(len(cards), 1)
        self.assertEqual(cards[0]["etapa_pipeline"], "Triagem")
        self.assertEqual(cards[0]["status_candidato"], "Em analise")

        move_response = move_candidate_pipeline_card(
            1,
            PipelineCardMoveRequest(
                etapa_pipeline="Aprovado",
                data_movimentacao="2026-04-18T11:00:00",
            ),
            repository=repository,
        )

        self.assertEqual(move_response, {"success": True})

        cards_after_move = get_candidate_pipeline(id_processo="", search="", repository=repository)
        self.assertEqual(cards_after_move[0]["etapa_pipeline"], "Aprovado")
        self.assertEqual(cards_after_move[0]["status_candidato"], "Aprovado")
