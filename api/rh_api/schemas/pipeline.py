from __future__ import annotations

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


class PipelineCardMoveRequest(BaseSchema):
    etapa_pipeline: str
    data_movimentacao: str | None = None
