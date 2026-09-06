"""Conversão de arquivos de escritório para PDF (LibreOffice headless).

Extraído como módulo próprio (em vez de estender `services/cv.py`) para não
alterar o comportamento já testado de extração de currículo — este arquivo
reaproveita apenas a mesma estratégia de detecção do binário do LibreOffice
(`soffice`/`LIBREOFFICE_PATH`) já em produção ali, aplicada agora à conversão
do slide `.pptx` da Central de Treinamentos para PDF (visualizador de
apresentação — ver docs/central-treinamentos/01-plano-tecnico.md §3/§4).

Opcional/degradável (CLAUDE.md): se o LibreOffice não estiver instalado ou a
conversão falhar por qualquer motivo, retorna `None` — o upload do arquivo
original continua funcionando normalmente, só o visualizador em tela cheia
fica indisponível até o LibreOffice ser instalado no servidor.
"""

from __future__ import annotations

import logging
import shutil
import subprocess
import tempfile
from pathlib import Path

from ..services.helpers import normalize_text

logger = logging.getLogger(__name__)


def _find_soffice_binary(libreoffice_path: str = "") -> str | None:
    return normalize_text(libreoffice_path) or shutil.which("soffice") or shutil.which("libreoffice") or None


def convert_office_document_to_pdf(
    content_bytes: bytes,
    *,
    original_extension: str,
    libreoffice_path: str = "",
    timeout_seconds: int = 60,
) -> bytes | None:
    """Converte `content_bytes` (ex.: um .pptx) para PDF via LibreOffice headless.

    Retorna os bytes do PDF gerado, ou `None` se o LibreOffice não estiver
    disponível ou a conversão falhar — nunca levanta exceção (blindagem
    defensiva, mesmo padrão do resto da conversão de documentos do Conecta)."""
    soffice = _find_soffice_binary(libreoffice_path)
    if not soffice:
        logger.warning(
            "LibreOffice não encontrado (LIBREOFFICE_PATH não configurado e 'soffice'/'libreoffice' "
            "ausentes do PATH); conversão para PDF indisponível — o arquivo original continua sendo salvo."
        )
        return None

    safe_extension = (original_extension or "").lstrip(".") or "bin"
    try:
        with tempfile.TemporaryDirectory(prefix="rh-office-conv-") as temp_dir:
            input_path = Path(temp_dir) / f"arquivo.{safe_extension}"
            output_dir = Path(temp_dir) / "out"
            output_dir.mkdir(parents=True, exist_ok=True)
            input_path.write_bytes(content_bytes)

            completed = subprocess.run(
                [soffice, "--headless", "--convert-to", "pdf", "--outdir", str(output_dir), str(input_path)],
                capture_output=True,
                text=True,
                timeout=timeout_seconds,
                check=False,
            )
            if completed.returncode != 0:
                logger.warning("Conversão LibreOffice→PDF falhou (código %s): %s", completed.returncode, normalize_text(completed.stderr))
                return None

            output_files = list(output_dir.glob("*.pdf"))
            if not output_files:
                logger.warning("Conversão LibreOffice→PDF não gerou nenhum arquivo de saída.")
                return None
            return output_files[0].read_bytes()
    except Exception:  # pragma: no cover - blindagem defensiva (mesmo padrão de cv.py)
        logger.exception("Falha inesperada ao converter arquivo para PDF via LibreOffice.")
        return None
