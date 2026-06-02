from __future__ import annotations

import base64
import hashlib
import hmac
import json
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status

from .config import get_settings
from .rbac import ROLE_ADMIN, get_role_definition, get_role_permissions, sanitize_permissions
from .services.helpers import normalize_text


@dataclass(frozen=True)
class AuthenticatedUser:
    username: str
    id_usuario: int | None = None
    nome: str = ""
    email: str = ""
    perfil: str = ROLE_ADMIN
    perfil_nome: str = "Administrador"
    nivel: str = "Completo"
    permissions: frozenset[str] = field(default_factory=lambda: frozenset(get_role_permissions(ROLE_ADMIN)))
    status: str = "Ativo"

    def has_permission(self, permission: str) -> bool:
        return permission in self.permissions

    def has_any_permission(self, *permissions: str) -> bool:
        return any(permission in self.permissions for permission in permissions)


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode((data + padding).encode("ascii"))


def _sign(payload: str, secret: str) -> str:
    digest = hmac.new(secret.encode("utf-8"), payload.encode("ascii"), hashlib.sha256).digest()
    return _b64encode(digest)


def _build_user_payload(user: AuthenticatedUser) -> dict:
    return {
        "sub": user.username,
        "uid": user.id_usuario,
        "name": user.nome,
        "email": user.email,
        "role": user.perfil,
        "role_name": user.perfil_nome,
        "level": user.nivel,
        "permissions": sorted(user.permissions),
        "status": user.status,
    }


def _build_token(user: AuthenticatedUser) -> str:
    settings = get_settings()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.auth_token_ttl_minutes)
    token_payload = {
        **_build_user_payload(user),
        "exp": int(expires_at.timestamp()),
    }
    payload = _b64encode(
        json.dumps(
            token_payload,
            separators=(",", ":"),
        ).encode("utf-8")
    )
    return f"{payload}.{_sign(payload, settings.auth_token_secret)}"


def _build_env_admin_user(usuario: str | None = None) -> AuthenticatedUser:
    settings = get_settings()
    safe_user = normalize_text(usuario) or settings.auth_user
    role = get_role_definition(ROLE_ADMIN)
    return AuthenticatedUser(
        username=safe_user,
        nome=safe_user,
        email=safe_user,
        perfil=role.id,
        perfil_nome=role.name,
        nivel=role.level,
        permissions=frozenset(get_role_permissions(role.id)),
        status="Ativo",
    )


def _user_from_record(record: dict | None) -> AuthenticatedUser:
    safe_record = record or {}
    role = get_role_definition(safe_record.get("perfil") or safe_record.get("perfil_id") or ROLE_ADMIN)
    permissions = sanitize_permissions(safe_record.get("permissoes") or safe_record.get("permissions"))
    if not permissions:
        permissions = get_role_permissions(role.id)
    return AuthenticatedUser(
        username=normalize_text(safe_record.get("login") or safe_record.get("usuario") or safe_record.get("email")),
        id_usuario=safe_record.get("id_usuario"),
        nome=normalize_text(safe_record.get("nome")) or normalize_text(safe_record.get("login")),
        email=normalize_text(safe_record.get("email")),
        perfil=role.id,
        perfil_nome=normalize_text(safe_record.get("perfil_nome")) or role.name,
        nivel=normalize_text(safe_record.get("nivel")) or role.level,
        permissions=frozenset(permissions),
        status=normalize_text(safe_record.get("status")) or "Ativo",
    )


def authenticate_credentials(usuario: str, senha: str) -> str:
    settings = get_settings()
    safe_user = normalize_text(usuario)
    if safe_user != settings.auth_user or senha != settings.auth_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario ou senha invalidos.",
        )

    return _build_token(_build_env_admin_user(safe_user))


def authenticate_session(
    usuario: str,
    senha: str,
    *,
    repository=None,
    origem: str = "",
) -> tuple[str, AuthenticatedUser]:
    safe_user = normalize_text(usuario)
    if repository is not None:
        try:
            record = repository.authenticate_system_user(
                safe_user,
                senha,
                origem=origem,
            )
            user = _user_from_record(record)
            return _build_token(user), user
        except HTTPException:
            settings = get_settings()
            if safe_user != settings.auth_user or senha != settings.auth_password:
                raise
        except Exception:
            # Fallback intencional para manter compatibilidade quando o banco ainda
            # nao possui as tabelas novas ou esta indisponivel durante manutencao.
            pass

    token = authenticate_credentials(safe_user, senha)
    return token, _build_env_admin_user(safe_user)


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

    role = get_role_definition(data.get("role") or data.get("perfil") or ROLE_ADMIN)
    permissions = sanitize_permissions(data.get("permissions") or data.get("permissoes"))
    if not permissions:
        permissions = get_role_permissions(role.id)

    return AuthenticatedUser(
        username=username,
        id_usuario=data.get("uid"),
        nome=normalize_text(data.get("name")) or username,
        email=normalize_text(data.get("email")),
        perfil=role.id,
        perfil_nome=normalize_text(data.get("role_name")) or role.name,
        nivel=normalize_text(data.get("level")) or role.level,
        permissions=frozenset(permissions),
        status=normalize_text(data.get("status")) or "Ativo",
    )
