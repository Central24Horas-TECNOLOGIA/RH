from __future__ import annotations

from email.message import EmailMessage
from pathlib import Path
from types import SimpleNamespace

from rh_api.services.email_inbox_service import EmailInboxService


def make_settings(**overrides):
    defaults = {
        "email_inbox_enabled": True,
        "email_inbox_provider": "microsoft365",
        "email_inbox_protocol": "imap",
        "email_inbox_auth_mode": "oauth2",
        "email_inbox_imap_host": "outlook.office365.com",
        "email_inbox_imap_port": 993,
        "email_inbox_address": "recrutamentoc24h@central24horas.com.br",
        "email_inbox_username": "",
        "email_inbox_mailbox": "INBOX",
        "email_inbox_tenant_id": "70559859-eef3-4b1c-86e7-14a6d0c732bd",
        "email_inbox_client_id": "client-id",
        "email_inbox_client_secret_env": "RH_EMAIL_CLIENT_SECRET_TEST",
        "email_inbox_oauth_scope": "https://outlook.office365.com/.default",
        "email_inbox_attachments_dir": "",
        "email_inbox_max_messages": 50,
        "email_inbox_max_attachment_mb": 10,
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def make_cv_message(filename: str = "curriculo_joao.pdf") -> EmailMessage:
    message = EmailMessage()
    message["From"] = "Joao Silva <joao@example.com>"
    message["Subject"] = "Joao Silva - Vaga Jovem Aprendiz"
    message["Date"] = "Sun, 10 May 2026 09:30:00 -0300"
    message["Message-ID"] = "<joao-silva@example.com>"
    message.set_content(
        "Nome: Joao Silva\nTelefone: (11) 99999-0000\nE-mail: joao@example.com\n"
    )
    message.add_attachment(
        b"%PDF-1.4\nconteudo",
        maintype="application",
        subtype="pdf",
        filename=filename,
    )
    message.add_attachment(
        b"assinatura",
        maintype="image",
        subtype="png",
        filename="assinatura.png",
    )
    return message


def test_status_disabled_returns_local_warning(monkeypatch):
    monkeypatch.delenv("RH_EMAIL_CLIENT_SECRET_TEST", raising=False)
    service = EmailInboxService(make_settings(email_inbox_enabled=False))

    status = service.status()

    assert status["enabled"] is False
    assert status["configured"] is False
    assert status["status"] == "disabled"
    assert "desativada" in status["message"]


def test_status_oauth2_requires_secret_env(monkeypatch):
    monkeypatch.delenv("RH_EMAIL_CLIENT_SECRET_TEST", raising=False)
    service = EmailInboxService(make_settings())

    status = service.status()

    assert status["enabled"] is True
    assert status["configured"] is False
    assert status["status"] == "not_configured"
    assert status["email_address"] == "recrutamentoc24h@central24horas.com.br"


def test_status_oauth2_configured_without_exposing_secret(monkeypatch):
    monkeypatch.setenv("RH_EMAIL_CLIENT_SECRET_TEST", "super-secret")
    service = EmailInboxService(make_settings())

    status = service.status()

    assert status["configured"] is True
    assert status["status"] == "configured"
    assert "super-secret" not in str(status)


def test_serialize_message_detects_cv_and_ignores_signature_image(monkeypatch):
    monkeypatch.setenv("RH_EMAIL_CLIENT_SECRET_TEST", "super-secret")
    service = EmailInboxService(make_settings())

    item = service._serialize_message("42", make_cv_message())

    assert item["possui_anexo"] is True
    assert item["nome_anexo"] == "curriculo_joao.pdf"
    assert [attachment["filename"] for attachment in item["anexos"]] == [
        "curriculo_joao.pdf"
    ]
    assert item["nome_detectado"] == "Joao Silva"
    assert item["vaga_detectada"] == "Jovem Aprendiz"
    assert item["email_detectado"] == "joao@example.com"


def test_download_cv_attachment_sanitizes_and_preserves_unique_names(monkeypatch):
    monkeypatch.setenv("RH_EMAIL_CLIENT_SECRET_TEST", "super-secret")
    root = Path("C:/ConectaRH/email_attachments_test")
    written_paths = set()

    def fake_mkdir(self, parents=False, exist_ok=False):
        return None

    def fake_exists(self):
        return str(self) in written_paths

    def fake_write_bytes(self, content):
        written_paths.add(str(self))
        return len(content)

    def fake_write_text(self, text, encoding=None):
        written_paths.add(str(self))
        return len(text)

    monkeypatch.setattr(Path, "mkdir", fake_mkdir)
    monkeypatch.setattr(Path, "exists", fake_exists)
    monkeypatch.setattr(Path, "write_bytes", fake_write_bytes)
    monkeypatch.setattr(Path, "write_text", fake_write_text)
    service = EmailInboxService(
        make_settings(email_inbox_attachments_dir=str(root))
    )
    message = make_cv_message("../curriculo joao.pdf")
    monkeypatch.setattr(service, "fetch_message", lambda uid: message)

    first = service.download_cv_attachments(uid="42", item_id="imap-test")
    second = service.download_cv_attachments(uid="42", item_id="imap-test")

    first_path = root / first["attachments"][0]["relative_path"]
    second_path = root / second["attachments"][0]["relative_path"]
    assert first_path != second_path
    assert first_path.name == "curriculo_joao.pdf"
    assert second_path.name == "curriculo_joao-2.pdf"
    assert ".." not in first["attachments"][0]["relative_path"]
