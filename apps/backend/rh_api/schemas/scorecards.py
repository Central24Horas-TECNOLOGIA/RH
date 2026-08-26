from __future__ import annotations

from pydantic import Field, field_validator

from .common import BaseSchema


class ScorecardCriterionInput(BaseSchema):
    criterio: str
    nota: int
    comentario: str = ""

    @field_validator("criterio")
    @classmethod
    def validate_criterio(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if not safe_value:
            raise ValueError("Informe o critério avaliado.")
        return safe_value

    @field_validator("nota")
    @classmethod
    def validate_nota(cls, value: int) -> int:
        if value < 1 or value > 5:
            raise ValueError("A nota deve estar entre 1 e 5.")
        return value


class ScorecardSaveRequest(BaseSchema):
    etapa_avaliada: str = ""
    criterios: list[ScorecardCriterionInput] = Field(default_factory=list)

    @field_validator("criterios")
    @classmethod
    def validate_criterios(cls, value: list[ScorecardCriterionInput]) -> list[ScorecardCriterionInput]:
        if not value:
            raise ValueError("Informe ao menos um critério avaliado.")
        return value
