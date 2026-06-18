from __future__ import annotations

from pydantic import Field

from .common import BaseSchema


class LoginRequest(BaseSchema):
    usuario: str = Field(default="")
    senha: str = Field(default="")


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
