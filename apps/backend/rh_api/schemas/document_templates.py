from __future__ import annotations

from pydantic import field_validator

from .common import BaseSchema


class DocumentTemplateCreateRequest(BaseSchema):
    titulo: str = ""
    corpo_texto: str = ""
    ativo: bool = True

    @field_validator("titulo")
    @classmethod
    def validate_titulo(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if not safe_value:
            raise ValueError("Informe o título do template.")
        if len(safe_value) > 255:
            raise ValueError("O título do template deve ter no máximo 255 caracteres.")
        return safe_value

    @field_validator("corpo_texto")
    @classmethod
    def validate_corpo_texto(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if not safe_value:
            raise ValueError("Informe o texto do template.")
        return safe_value


class DocumentTemplateUpdateRequest(DocumentTemplateCreateRequest):
    pass


class GenerateDocumentRequest(BaseSchema):
    template_id: int
    id_registro: int
    variaveis_extra: dict[str, str] = {}

    @field_validator("template_id", "id_registro")
    @classmethod
    def validate_ids(cls, value: int) -> int:
        if not value or int(value) <= 0:
            raise ValueError("Identificador inválido.")
        return int(value)
