from __future__ import annotations

from pydantic import field_validator

from .common import BaseSchema


class OnboardingTrilhaItemInput(BaseSchema):
    titulo: str = ""
    descricao: str = ""
    ordem: int = 0
    obrigatorio: bool = True

    @field_validator("titulo")
    @classmethod
    def validate_titulo(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if not safe_value:
            raise ValueError("Informe o título do item da trilha.")
        if len(safe_value) > 255:
            raise ValueError("O título do item deve ter no máximo 255 caracteres.")
        return safe_value


class OnboardingTrilhaCreateRequest(BaseSchema):
    nome: str = ""
    descricao: str = ""
    ativo: bool = True
    itens: list[OnboardingTrilhaItemInput] = []

    @field_validator("nome")
    @classmethod
    def validate_nome(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if not safe_value:
            raise ValueError("Informe o nome da trilha de onboarding.")
        if len(safe_value) > 255:
            raise ValueError("O nome da trilha deve ter no máximo 255 caracteres.")
        return safe_value


class OnboardingTrilhaUpdateRequest(OnboardingTrilhaCreateRequest):
    pass


class OnboardingStartRequest(BaseSchema):
    id_registro: int
    trilha_id: int

    @field_validator("id_registro", "trilha_id")
    @classmethod
    def validate_ids(cls, value: int) -> int:
        if not value or int(value) <= 0:
            raise ValueError("Identificador inválido.")
        return int(value)


class OnboardingItemToggleRequest(BaseSchema):
    concluido: bool = True
