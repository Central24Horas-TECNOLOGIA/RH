from __future__ import annotations

import pytest
from fastapi import HTTPException

from rh_api.config import get_settings
from rh_api.services.onedrive_service import OneDriveService


def _unconfigured_service() -> OneDriveService:
    service = OneDriveService(get_settings())
    assert not service.configured
    return service


@pytest.mark.parametrize("filename", ["virus.exe", "script.ps1", "malware.bat", "trojan.js"])
def test_upload_rejects_executable_and_script_extensions(filename):
    service = _unconfigured_service()
    with pytest.raises(HTTPException) as exc_info:
        service.upload_file("Documentos", filename, b"conteudo")
    assert exc_info.value.status_code == 400
    assert "não pode ser enviado" in exc_info.value.detail


@pytest.mark.parametrize("filename", ["contrato.pdf", "planilha.xlsx", "foto.png", "politica.docx"])
def test_upload_allows_common_document_extensions_to_reach_the_client(filename):
    service = _unconfigured_service()
    # Passou pela checagem de extensão; o 503 confirma que chegou até a
    # tentativa de falar com o Graph (não configurado neste ambiente de teste).
    with pytest.raises(HTTPException) as exc_info:
        service.upload_file("Documentos", filename, b"conteudo")
    assert exc_info.value.status_code == 503
