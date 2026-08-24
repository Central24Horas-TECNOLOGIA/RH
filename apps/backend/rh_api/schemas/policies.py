from __future__ import annotations

from pydantic import field_validator

from .common import BaseSchema


class PolicyCreateRequest(BaseSchema):
    titulo: str = ""
    corpo_texto: str = ""
    ativo: bool = True

    @field_validator("titulo")
    @classmethod
    def validate_titulo(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if not safe_value:
            raise ValueError("Informe o título da política.")
        if len(safe_value) > 255:
            raise ValueError("O título da política deve ter no máximo 255 caracteres.")
        return safe_value

    @field_validator("corpo_texto")
    @classmethod
    def validate_corpo_texto(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if not safe_value:
            raise ValueError("Informe o texto da política.")
        return safe_value


class PolicyUpdateRequest(PolicyCreateRequest):
    pass
