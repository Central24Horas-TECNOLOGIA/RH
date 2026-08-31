from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from rh_api.auth import AuthenticatedUser
from rh_api.config import get_settings
from rh_api.dependencies import get_current_user, get_repository
from rh_api.routers import email_send as email_send_routes
from rh_api.schemas.email_send import EmailSendRequest


class _StubRepository:
    def list_configuration_catalog(self) -> dict:
        return {"sections": []}


class _StubEmailSendService:
    def send_mail(self, **kwargs) -> dict:
        return {"success": True}


class _StubOneDriveService:
    def download_file_base64(self, caminho: str):
        return "", caminho, "application/octet-stream"


def _build_client() -> TestClient:
    app = FastAPI()
    app.include_router(email_send_routes.router)
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        username="rh.teste",
        id_usuario=1,
        permissions=frozenset({"emails.enviar_livre"}),
    )
    app.dependency_overrides[get_repository] = lambda: _StubRepository()
    app.dependency_overrides[email_send_routes.get_email_send_service] = lambda: _StubEmailSendService()
    app.dependency_overrides[email_send_routes.get_onedrive_service] = lambda: _StubOneDriveService()
    return TestClient(app)


def test_email_send_request_rejects_more_than_fifty_recipients():
    with pytest.raises(ValidationError):
        EmailSendRequest(destinatarios=[f"user{i}@example.com" for i in range(51)], corpo_html="Olá")


def test_email_send_request_rejects_more_than_ten_attachments():
    with pytest.raises(ValidationError):
        EmailSendRequest(
            destinatarios=["a@example.com"],
            corpo_html="Olá",
            anexos_onedrive=[f"Documentos/arquivo{i}.pdf" for i in range(11)],
        )


def test_send_email_is_rate_limited_after_repeated_calls():
    email_send_routes.email_send_limiter.reset("rh.teste")
    client = _build_client()
    settings = get_settings()

    for _ in range(settings.email_send_rate_limit):
        resposta = client.post(
            "/emails/enviar",
            json={"destinatarios": ["candidato@example.com"], "corpo_html": "Olá"},
        )
        assert resposta.status_code == 200

    bloqueado = client.post(
        "/emails/enviar",
        json={"destinatarios": ["candidato@example.com"], "corpo_html": "Olá"},
    )
    assert bloqueado.status_code == 429

    email_send_routes.email_send_limiter.reset("rh.teste")
