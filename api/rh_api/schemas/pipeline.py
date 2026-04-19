from __future__ import annotations

from pydantic import field_validator

from .common import BaseSchema


class PipelineCardCreateRequest(BaseSchema):
    id_processo: str
    nome_candidato: str
    vaga: str = ""
    etapa_pipeline: str = "Triagem"
    id_teste: str | None = None
    pontuacao_final: str | float | int | None = None
    data_prova: str | None = None
    origem: str = "Pipeline manual"

    @field_validator("id_processo", "nome_candidato")
    @classmethod
    def validate_required_fields(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if not safe_value:
            raise ValueError("Informe processo e nome do candidato para criar o card.")
        return safe_value


class PipelineCardMoveRequest(BaseSchema):
    etapa_pipeline: str
    data_movimentacao: str | None = None

    @field_validator("etapa_pipeline")
    @classmethod
    def validate_stage(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if not safe_value:
            raise ValueError("Informe a etapa de destino do pipeline.")
        return safe_value
