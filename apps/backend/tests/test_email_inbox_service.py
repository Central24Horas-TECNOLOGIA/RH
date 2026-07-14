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


def make_work_with_us_message(*, html_body: bool = True, attachment: bool = False, experience: str = " Sim ") -> EmailMessage:
    message = EmailMessage()
    message["From"] = "Site Central24 <site@central24horas.com.br>"
    message["Subject"] = "[Site] Candidato (RH)"
    message["Date"] = "Sun, 10 May 2026 11:00:00 -0300"
    message["Message-ID"] = "<trabalhe-conosco@example.com>"
    text = f"""
Novo cadastro RH

Nome
Teste Candidato

Endereço
Rua Teste

E-mail
teste@ovlk.com.br

Telefone
+55 (11) 1231-2312

Escolaridade
1º Grau

Experiência
{experience}

Pesquisa cultural

Música
boa

Prato
cheio

Futebol
não liga

Time
que ganha

Rede social
https://social.example/teste

Currículo anexado
Sim
"""
    if html_body:
        html = "".join(f"<p>{line}</p>" for line in text.splitlines())
        message.add_alternative(html, subtype="html")
    else:
        message.set_content(text)
    if attachment:
        message.add_attachment(
            b"%PDF-1.4\nconteudo",
            maintype="application",
            subtype="pdf",
            filename="curriculo_teste.pdf",
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


def test_serialize_message_extracts_work_with_us_html_fields(monkeypatch):
    monkeypatch.setenv("RH_EMAIL_CLIENT_SECRET_TEST", "super-secret")
    service = EmailInboxService(make_settings())

    item = service._serialize_message("43", make_work_with_us_message(attachment=True))

    assert item["trabalhe_conosco"] is True
    assert item["nome_detectado"] == "Teste Candidato"
    assert item["email_detectado"] == "teste@ovlk.com.br"
    assert item["telefone_detectado"] == "+55 (11) 1231-2312"
    assert item["experiencia_detectada"] == "Sim"
    assert item["campos_formulario"]["endereco"] == "Rua Teste"
    assert item["campos_formulario"]["escolaridade"] == "1º Grau"
    assert item["campos_formulario"]["musica"] == "boa"
    assert item["campos_formulario"]["rede_social"] == "https://social.example/teste"
    assert item["possui_anexo"] is True


def test_serialize_message_extracts_work_with_us_plain_text_without_cv(monkeypatch):
    monkeypatch.setenv("RH_EMAIL_CLIENT_SECRET_TEST", "super-secret")
    service = EmailInboxService(make_settings())

    item = service._serialize_message(
        "44",
        make_work_with_us_message(html_body=False, attachment=False, experience="  não "),
    )

    assert item["trabalhe_conosco"] is True
    assert item["experiencia_detectada"] == "Nao"
    assert item["possui_anexo"] is False
    assert "Curriculo informado como anexado" in " ".join(item["inconsistencias"])


def test_serialize_message_does_not_classify_regular_email_without_form(monkeypatch):
    monkeypatch.setenv("RH_EMAIL_CLIENT_SECRET_TEST", "super-secret")
    service = EmailInboxService(make_settings())
    message = EmailMessage()
    message["From"] = "Fornecedor <fornecedor@example.com>"
    message["Subject"] = "Reunião semanal"
    message.set_content("Segue resumo da reunião, sem dados de candidatura.")

    item = service._serialize_message("45", message)

    assert item["trabalhe_conosco"] is False


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
