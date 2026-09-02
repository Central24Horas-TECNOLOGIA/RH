from __future__ import annotations

import re

from pydantic import Field, field_validator

from .common import BaseSchema

_AVATAR_ILUSTRADO_PATTERN = re.compile(r"^avatar-(0[1-9]|[12]\d|3\d|40)$")


class LoginRequest(BaseSchema):
    usuario: str = Field(default="")
    senha: str = Field(default="")
    mfa_code: str = Field(default="", max_length=12)


class E2ETestLoginRequest(BaseSchema):
    """Achado QA-001/S-23: bypass de autenticação restrito à suíte E2E, nunca
    disponível em produção — ver routers/auth.py (`e2e_test_login`)."""

    secret: str = Field(default="", max_length=200)
    usuario: str = Field(default="e2e.teste", max_length=120)
    perfil: str = Field(default="administrador", max_length=40)


class MfaCodeRequest(BaseSchema):
    code: str = Field(min_length=6, max_length=12)


class MfaSetupResponse(BaseSchema):
    secret: str
    provisioning_uri: str
    message: str = "Escaneie o QR code e confirme um código antes de ativar o MFA."


class LoginResponse(BaseSchema):
    access_token: str
    token_type: str = "bearer"
    usuario: str
    nome: str = ""
    email: str = ""
    perfil: str = "administrador"
    perfil_nome: str = "Administrador"
    nivel: str = "Completo"
    permissoes: list[str] = []
    avatar_ilustrado: str = ""


class SessionResponse(BaseSchema):
    authenticated: bool = True
    usuario: str
    nome: str = ""
    email: str = ""
    perfil: str = "administrador"
    perfil_nome: str = "Administrador"
    nivel: str = "Completo"
    permissoes: list[str] = []
    avatar_ilustrado: str = ""
    access_token: str = ""


class UpdateAvatarRequest(BaseSchema):
    avatar_ilustrado: str = Field(default="")

    @field_validator("avatar_ilustrado")
    @classmethod
    def validate_avatar(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if safe_value and not _AVATAR_ILUSTRADO_PATTERN.fullmatch(safe_value):
            raise ValueError("Avatar inválido.")
        return safe_value


class UpdateNameRequest(BaseSchema):
    nome: str = Field(default="")

    @field_validator("nome")
    @classmethod
    def validate_nome(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if not (2 <= len(safe_value) <= 120):
            raise ValueError("Informe um nome entre 2 e 120 caracteres.")
        return safe_value


class UpdateOwnPasswordRequest(BaseSchema):
    senha_atual: str = Field(default="")
    nova_senha: str = Field(default="")

    @field_validator("nova_senha")
    @classmethod
    def validate_nova_senha(cls, value: str) -> str:
        safe_value = str(value or "")
        if len(safe_value) < 8:
            raise ValueError("A nova senha deve ter pelo menos 8 caracteres.")
        return safe_value
