from __future__ import annotations

from .common import BaseSchema


class HistoryRecordRequest(BaseSchema):
    id_teste: str = ""
    id_processo: str = ""
    id_processo_ref: str = ""
    nome_candidato: str = ""
    vaga: str = ""
    nivel: str = ""
    trilha: str = ""
    data_iso: str = ""
    data_exibicao: str = ""
    pontuacao_final: str | float | int = ""
    status: str = ""
    tempo_minutos: int | float = 0
    arquivo_gabarito: str = ""
    etapas_json: str = ""


class AnswerFileRequest(BaseSchema):
    recordId: str
    payload: str | dict
