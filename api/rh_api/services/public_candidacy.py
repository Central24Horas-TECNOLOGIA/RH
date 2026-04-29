from __future__ import annotations

import secrets
import unicodedata
import zipfile
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from urllib.parse import quote, urlsplit, urlunsplit

from fastapi import HTTPException, status

from .helpers import normalize_text
from .public_job_texts import get_default_public_job_texts


PUBLIC_CANDIDACY_ROUTE = "candidatar"
PUBLIC_CV_MAX_BYTES = 5 * 1024 * 1024
PUBLIC_APPLICATION_ORIGIN = "Pagina de candidatura"
PUBLIC_APPLICATION_SUCCESS_MESSAGE = (
    "Candidatura enviada com sucesso. Recebemos suas informacoes e seu curriculo. "
    "O RH analisara seu perfil e podera entrar em contato pelo telefone ou e-mail informado."
)
PUBLIC_APPLICATION_DUPLICATE_MESSAGE = "Voce ja possui candidatura registrada para esta vaga."
PUBLIC_APPLICATION_CLOSED_MESSAGE = "Esta vaga esta encerrada e nao aceita novas candidaturas."

_ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx"}
_PDF_MAGIC = b"%PDF"
_DOC_MAGIC = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
_GENERIC_CONTENT_TYPES = {"application/octet-stream", "binary/octet-stream"}
_ALLOWED_CONTENT_TYPES = {
    ".pdf": {"application/pdf"},
    ".doc": {"application/msword", "application/doc"},
    ".docx": {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/zip",
    },
}
_MIME_BY_EXTENSION = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


@dataclass(frozen=True)
class ValidatedPublicCvUpload:
    original_filename: str
    stored_filename: str
    extension: str
    mime_type: str
    size_bytes: int
    content_bytes: bytes


def slugify_public_text(value: str, *, fallback: str = "vaga", max_length: int = 48) -> str:
    normalized = unicodedata.normalize("NFD", normalize_text(value))
    without_marks = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
    sanitized = []
    last_was_dash = False

    for char in without_marks.lower():
        if char.isalnum():
            sanitized.append(char)
            last_was_dash = False
            continue

        if sanitized and not last_was_dash:
            sanitized.append("-")
            last_was_dash = True

    slug = "".join(sanitized).strip("-")
    if not slug:
        slug = fallback
    if len(slug) > max_length:
        slug = slug[:max_length].rstrip("-")
    return slug or fallback


def generate_public_token(length: int = 8) -> str:
    token = secrets.token_urlsafe(length).lower()
    return "".join(char for char in token if char.isalnum())[: max(6, length)]


def build_public_process_slug(vaga: str, token: str) -> str:
    return f"{slugify_public_text(vaga)}-{normalize_text(token).lower()}"


def resolve_public_frontend_base_url(
    configured_base_url: str = "",
    *,
    referrer_url: str = "",
    origin_url: str = "",
) -> str:
    candidate = normalize_text(configured_base_url) or normalize_text(referrer_url) or normalize_text(origin_url)
    if not candidate:
        return "http://127.0.0.1:5500/Front/index.html"

    parts = urlsplit(candidate)
    path = parts.path or ""

    if not path or path == "/":
        path = "/Front/index.html"

    return urlunsplit((parts.scheme or "http", parts.netloc, path, parts.query, ""))


def build_public_application_url(base_url: str, slug: str) -> str:
    safe_slug = normalize_text(slug)
    if not safe_slug:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Slug publico da vaga nao informado.",
        )

    base = resolve_public_frontend_base_url(base_url)
    return f"{base}#/{PUBLIC_CANDIDACY_ROUTE}/{quote(safe_slug)}"


def resolve_public_process_description(processo: dict | None) -> str:
    safe_process = processo or {}
    descricao_publica = normalize_text(safe_process.get("descricao_publica"))
    if descricao_publica:
        return descricao_publica

    return get_default_public_job_texts(safe_process)["descricao"]


def resolve_public_process_requirements(processo: dict | None) -> str:
    safe_process = processo or {}
    requisitos_publicos = normalize_text(safe_process.get("requisitos_publicos"))
    if requisitos_publicos:
        return requisitos_publicos

    return "\n".join(get_default_public_job_texts(safe_process)["requisitos"])


def resolve_public_process_responsibilities(processo: dict | None) -> str:
    safe_process = processo or {}
    responsabilidades_publicas = normalize_text(safe_process.get("responsabilidades_publicas"))
    if responsabilidades_publicas:
        return responsabilidades_publicas

    return "\n".join(get_default_public_job_texts(safe_process)["responsabilidades"])


def validate_public_cv_upload(
    filename: str,
    content_type: str,
    content_bytes: bytes,
) -> ValidatedPublicCvUpload:
    safe_name = normalize_text(filename)
    extension = Path(safe_name).suffix.lower()
    if extension not in _ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Envie um curriculo em PDF, DOC ou DOCX.",
        )

    safe_content = content_bytes or b""
    if not safe_content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O arquivo do curriculo esta vazio.",
        )

    if len(safe_content) > PUBLIC_CV_MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O curriculo excede o limite de 5 MB permitido.",
        )

    normalized_content_type = normalize_text(content_type).lower()
    allowed_content_types = _ALLOWED_CONTENT_TYPES.get(extension, set())
    if (
        normalized_content_type
        and normalized_content_type not in allowed_content_types
        and normalized_content_type not in _GENERIC_CONTENT_TYPES
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O tipo do arquivo enviado nao corresponde a um curriculo valido.",
        )

    if extension == ".pdf":
        if not safe_content.startswith(_PDF_MAGIC):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="O PDF enviado esta invalido ou corrompido.",
            )
    elif extension == ".doc":
        if not safe_content.startswith(_DOC_MAGIC):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="O arquivo DOC enviado esta invalido ou corrompido.",
            )
    elif extension == ".docx":
        if not safe_content.startswith(b"PK"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="O arquivo DOCX enviado esta invalido ou corrompido.",
            )
        try:
            with zipfile.ZipFile(BytesIO(safe_content)) as zip_file:
                if "word/document.xml" not in zip_file.namelist():
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="O arquivo DOCX enviado nao possui a estrutura esperada.",
                    )
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="O arquivo DOCX enviado esta invalido ou corrompido.",
            ) from exc

    stored_filename = f"{slugify_public_text(Path(safe_name).stem, fallback='curriculo', max_length=28)}-{secrets.token_hex(10)}{extension}"
    return ValidatedPublicCvUpload(
        original_filename=safe_name,
        stored_filename=stored_filename,
        extension=extension,
        mime_type=_MIME_BY_EXTENSION[extension],
        size_bytes=len(safe_content),
        content_bytes=safe_content,
    )
