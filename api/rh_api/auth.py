from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import time
from dataclasses import dataclass

from fastapi import HTTPException, status

from .config import get_settings


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AuthenticatedUser:
    username: str


def _b64_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("utf-8").rstrip("=")


def _b64_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode((value + padding).encode("utf-8"))


def _token_secret() -> bytes:
    return get_settings().auth_token_secret.encode("utf-8")


def create_access_token(username: str) -> str:
    settings = get_settings()
    payload = {
        "sub": username,
        "exp": int(time.time()) + max(settings.auth_token_ttl_minutes, 1) * 60,
    }
    payload_text = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    payload_encoded = _b64_encode(payload_text.encode("utf-8"))
    signature = hmac.new(_token_secret(), payload_encoded.encode("utf-8"), hashlib.sha256).digest()
    return f"{payload_encoded}.{_b64_encode(signature)}"


def authenticate_credentials(username: str, password: str) -> str:
    settings = get_settings()
    if not settings.auth_user or not settings.auth_password:
        logger.error("Tentativa de login com autenticacao local nao configurada.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Autenticacao local nao configurada. Preencha RH_AUTH_USER e RH_AUTH_PASSWORD no .env.",
        )

    username_safe = str(username or "").strip()
    password_safe = str(password or "")

    valid_username = hmac.compare_digest(username_safe, settings.auth_user)
    valid_password = hmac.compare_digest(password_safe, settings.auth_password)
    if not (valid_username and valid_password):
        logger.warning("Falha de autenticacao para o usuario '%s'.", username_safe or "<vazio>")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario ou senha invalidos.",
        )

    logger.info("Login autenticado com sucesso para o usuario '%s'.", username_safe)
    return create_access_token(username_safe)


def validate_access_token(token: str) -> AuthenticatedUser:
    if not token or "." not in token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token de acesso invalido.")

    encoded_payload, encoded_signature = token.split(".", 1)
    expected_signature = hmac.new(
        _token_secret(),
        encoded_payload.encode("utf-8"),
        hashlib.sha256,
    ).digest()

    try:
        actual_signature = _b64_decode(encoded_signature)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de acesso invalido.",
        ) from exc

    if not hmac.compare_digest(actual_signature, expected_signature):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token de acesso invalido.")

    try:
        payload = json.loads(_b64_decode(encoded_payload).decode("utf-8"))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de acesso invalido.",
        ) from exc

    expires_at = int(payload.get("exp", 0) or 0)
    if expires_at <= int(time.time()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessao expirada. Faca login novamente.")

    username = str(payload.get("sub") or "").strip()
    if not username:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token de acesso invalido.")

    return AuthenticatedUser(username=username)
