from __future__ import annotations

import base64
import hashlib
import hmac
import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status

from .config import get_settings
from .services.helpers import normalize_text


@dataclass(frozen=True)
class AuthenticatedUser:
    username: str


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode((data + padding).encode("ascii"))


def _sign(payload: str, secret: str) -> str:
    digest = hmac.new(secret.encode("utf-8"), payload.encode("ascii"), hashlib.sha256).digest()
    return _b64encode(digest)


def authenticate_credentials(usuario: str, senha: str) -> str:
    settings = get_settings()
    safe_user = normalize_text(usuario)
    if safe_user != settings.auth_user or senha != settings.auth_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario ou senha invalidos.",
        )

    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.auth_token_ttl_minutes)
    payload = _b64encode(
        json.dumps(
            {"sub": safe_user, "exp": int(expires_at.timestamp())},
            separators=(",", ":"),
        ).encode("utf-8")
    )
    return f"{payload}.{_sign(payload, settings.auth_token_secret)}"


def validate_access_token(token: str) -> AuthenticatedUser:
    settings = get_settings()
    try:
        payload, signature = normalize_text(token).split(".", 1)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalido.") from exc

    expected_signature = _sign(payload, settings.auth_token_secret)
    if not hmac.compare_digest(signature, expected_signature):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalido.")

    try:
        data = json.loads(_b64decode(payload).decode("utf-8"))
        username = normalize_text(data.get("sub"))
        expires_at = int(data.get("exp") or 0)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalido.") from exc

    if not username or expires_at < int(datetime.now(timezone.utc).timestamp()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessao expirada.")

    return AuthenticatedUser(username=username)
