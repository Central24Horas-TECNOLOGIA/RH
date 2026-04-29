from __future__ import annotations

import asyncio
import io
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

from fastapi import HTTPException
from starlette.datastructures import UploadFile
from starlette.requests import Request

API_DIR = Path(__file__).resolve().parents[1]
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from rh_api.repositories.public_candidacy import PublicCandidacyRepositoryMixin
from rh_api.routers.processes import generate_public_application_link
from rh_api.routers.public_candidacy import get_public_application, submit_public_application
from rh_api.services.public_candidacy import (
    PUBLIC_APPLICATION_CLOSED_MESSAGE,
    build_public_application_url,
    resolve_public_frontend_base_url,
    validate_public_cv_upload,
)


class DummyPublicRepository(PublicCandidacyRepositoryMixin):
    def __init__(self):
        self.settings = SimpleNamespace(
            public_frontend_base_url="http://127.0.0.1:5500/Front/index.html",
            public_cv_upload_dir=str(API_DIR / "tmp-public-cv-tests"),
        )


class FakePublicRouterRepository:
    def __init__(self):
        self.generate_calls: list[dict] = []
        self.submit_calls: list[dict] = []

    def generate_public_application_link(self, id_processo: str, *, referrer_url: str = "", origin_url: str = ""):
        self.generate_calls.append(
            {
                "id_processo": id_processo,
                "referrer_url": referrer_url,
                "origin_url": origin_url,
            }
        )
        return {
            "success": True,
            "status": "Ativa",
            "slug": "vaga-operador-k7d92a9p",
            "url": "http://127.0.0.1:5500/Front/index.html#/candidatar/vaga-operador-k7d92a9p",
        }

    def get_public_application(self, slug: str):
        return {
            "slug": slug,
            "vaga": "Operador",
            "descricao_publica": "Descricao publica da vaga.",
            "requisitos_publicos": "Experiencia com atendimento.",
            "disponivel": True,
            "status": "Ativa",
            "mensagem": "",
        }

    async def submit_public_application(self, slug: str, **payload):
        self.submit_calls.append({"slug": slug, **payload})
        return {
            "success": True,
            "duplicate": False,
            "message": "ok",
        }


class PublicCandidacyTests(unittest.TestCase):
    def test_build_public_application_url_preserves_front_index_path(self):
        base_url = resolve_public_frontend_base_url(
            "",
            referrer_url="http://127.0.0.1:5500/Front/index.html#/detalhes-processo",
        )

        self.assertEqual(base_url, "http://127.0.0.1:5500/Front/index.html")
        self.assertEqual(
            build_public_application_url(base_url, "vaga-operador-k7d92a9p"),
            "http://127.0.0.1:5500/Front/index.html#/candidatar/vaga-operador-k7d92a9p",
        )

    def test_validate_public_cv_upload_accepts_pdf_and_sanitizes_storage_name(self):
        upload = validate_public_cv_upload(
            "Curriculo Ana Souza.pdf",
            "application/pdf",
            b"%PDF-1.7\nconteudo",
        )

        self.assertEqual(upload.extension, ".pdf")
        self.assertEqual(upload.mime_type, "application/pdf")
        self.assertNotEqual(upload.original_filename, upload.stored_filename)
        self.assertTrue(upload.stored_filename.endswith(".pdf"))

    def test_validate_public_cv_upload_rejects_invalid_extension(self):
        with self.assertRaises(HTTPException) as context:
            validate_public_cv_upload(
                "curriculo.png",
                "image/png",
                b"\x89PNG\r\n\x1a\n",
            )

        self.assertEqual(context.exception.status_code, 400)
        self.assertIn("PDF, DOC ou DOCX", context.exception.detail)

    def test_validate_public_cv_upload_rejects_invalid_docx_structure(self):
        with self.assertRaises(HTTPException) as context:
            validate_public_cv_upload(
                "curriculo.docx",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                b"PK\x03\x04arquivo-invalido",
            )

        self.assertEqual(context.exception.status_code, 400)
        self.assertIn("DOCX", context.exception.detail)

    def test_public_process_payload_marks_closed_or_inactive_link(self):
        repository = DummyPublicRepository()
        payload = repository._build_public_process_payload(
            {
                "vaga": "Operador",
                "status": "Encerrado",
                "link_publico_ativo": 1,
                "descricao_publica": "",
                "requisitos_publicos": "",
                "responsabilidades_publicas": "",
                "observacoes_publicas_vaga": "Necessario disponibilidade para escala 6x1.",
                "link_publico_slug": "vaga-operador-k7d92a9p",
            }
        )

        self.assertFalse(payload["disponivel"])
        self.assertEqual(payload["status"], "Inativa")
        self.assertEqual(payload["mensagem"], PUBLIC_APPLICATION_CLOSED_MESSAGE)
        self.assertIn("responsabilidades_publicas", payload)
        self.assertEqual(
            payload["observacoes_publicas_vaga"],
            "Necessario disponibilidade para escala 6x1.",
        )

    def test_generate_public_link_router_forwards_request_headers(self):
        repository = FakePublicRouterRepository()
        request = Request(
            {
                "type": "http",
                "method": "POST",
                "headers": [
                    (b"origin", b"http://127.0.0.1:5500"),
                    (b"referer", b"http://127.0.0.1:5500/Front/index.html#/detalhes-processo"),
                ],
            }
        )

        payload = generate_public_application_link(
            "PROC.OPR.001@@2026-04-27T10:00:00",
            request=request,
            repository=repository,
        )

        self.assertTrue(payload["success"])
        self.assertEqual(repository.generate_calls[0]["origin_url"], "http://127.0.0.1:5500")
        self.assertIn("detalhes-processo", repository.generate_calls[0]["referrer_url"])

    def test_public_submit_router_forwards_form_and_file_to_repository(self):
        repository = FakePublicRouterRepository()
        upload = UploadFile(
            file=io.BytesIO(b"%PDF-1.7\nconteudo"),
            filename="curriculo.pdf",
            headers={"content-type": "application/pdf"},
        )

        response = asyncio.run(
            submit_public_application(
                "vaga-operador-k7d92a9p",
                nome_completo="Ana Souza",
                email="ana@teste.com",
                telefone="21999999999",
                area_interesse="Operador",
                resumo_profissional="Experiencia com atendimento.",
                cidade="Rio de Janeiro",
                bairro="Centro",
                lgpd_aceito="1",
                curriculo=upload,
                repository=repository,
            )
        )

        self.assertTrue(response["success"])
        self.assertEqual(repository.submit_calls[0]["slug"], "vaga-operador-k7d92a9p")
        self.assertEqual(repository.submit_calls[0]["nome_completo"], "Ana Souza")
        self.assertEqual(repository.submit_calls[0]["resumo_profissional"], "Experiencia com atendimento.")
        self.assertEqual(repository.submit_calls[0]["curriculo"].filename, "curriculo.pdf")

    def test_public_get_router_returns_repository_payload(self):
        repository = FakePublicRouterRepository()

        payload = get_public_application(
            "vaga-operador-k7d92a9p",
            repository=repository,
        )

        self.assertEqual(payload["slug"], "vaga-operador-k7d92a9p")
        self.assertTrue(payload["disponivel"])


if __name__ == "__main__":
    unittest.main()
