from __future__ import annotations

from pydantic import Field

from .common import BaseSchema


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


class SessionResponse(BaseSchema):
    authenticated: bool = True
    usuario: str
    nome: str = ""
    email: str = ""
    perfil: str = "administrador"
    perfil_nome: str = "Administrador"
    nivel: str = "Completo"
    permissoes: list[str] = []
