from __future__ import annotations

from pydantic import field_validator

from .common import BaseSchema


class CriarPastaDocumentoRhRequest(BaseSchema):
    nome: str
    id_pasta_pai: int | None = None

    @field_validator("nome")
    @classmethod
    def validar_nome(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if not safe_value:
            raise ValueError("Informe um nome para a pasta.")
        return safe_value


class RenomearDocumentoRhRequest(BaseSchema):
    nome: str

    @field_validator("nome")
    @classmethod
    def validar_nome(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if not safe_value:
            raise ValueError("Informe um novo nome.")
        return safe_value
