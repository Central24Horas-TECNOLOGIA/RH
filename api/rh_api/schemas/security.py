from __future__ import annotations

from pydantic import Field

from .common import BaseSchema


class UserCreateRequest(BaseSchema):
    nome: str = Field(default="")
    email: str = Field(default="")
    login: str = Field(default="")
    senha: str = Field(default="")
    perfil: str = Field(default="estagiario")
    status: str = Field(default="Ativo")


class UserUpdateRequest(BaseSchema):
    nome: str = Field(default="")
    email: str = Field(default="")
    login: str = Field(default="")
    perfil: str = Field(default="")
    status: str = Field(default="")
    justificativa: str = Field(default="")


class UserPasswordRequest(BaseSchema):
    senha: str = Field(default="")
    justificativa: str = Field(default="")


class UserStatusRequest(BaseSchema):
    acao: str = Field(default="")
    justificativa: str = Field(default="")


class RolePermissionsUpdateRequest(BaseSchema):
    permissoes: list[str] = Field(default_factory=list)
    justificativa: str = Field(default="")


class ConfigurationItemRequest(BaseSchema):
    chave: str = Field(default="")
    nome: str = Field(default="")
    descricao: str = Field(default="")
    categoria: str = Field(default="")
    payload: dict = Field(default_factory=dict)
    ativo: bool = True
    justificativa: str = Field(default="")


class LgpdRequestCreate(BaseSchema):
    tipo_solicitacao: str = Field(default="")
    titular: str = Field(default="")
    email: str = Field(default="")
    descricao: str = Field(default="")
