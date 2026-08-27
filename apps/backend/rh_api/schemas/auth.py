from __future__ import annotations

import re

from pydantic import Field, field_validator

from .common import BaseSchema

_AVATAR_ILUSTRADO_PATTERN = re.compile(r"^avatar-(0[1-9]|[12]\d|3\d|40)$")


class LoginRequest(BaseSchema):
    usuario: str = Field(default="")
    senha: str = Field(default="")
    mfa_code: str = Field(default="", max_length=12)


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
