from __future__ import annotations

from .common import BaseSchema


class ProcessCreateRequest(BaseSchema):
    id_processo: str = ""
    vaga: str = ""
    quantidade_vagas: int = 0
    vagas_preenchidas: int = 0
    data_encerramento: str = ""
    operacao: str = ""
    trilha: str = ""
    usa_nota_corte: int = 0
    nota_corte: float | None = None
    status: str = "Aberto"
    data_criacao: str = ""


class ProcessUpdateRequest(BaseSchema):
    quantidade_vagas: int = 0
    data_encerramento: str = ""
    operacao: str = ""
    trilha: str = ""
    usa_nota_corte: int = 0
    nota_corte: float | None = None
    status: str = "Aberto"


class ProcessCandidateCreateRequest(BaseSchema):
    id_processo: str = ""
    id_teste: str = ""
    nome_candidato: str = ""
    vaga: str = ""
    status_candidato: str = "Em analise"
    pontuacao_final: str | float | int = ""
    data_prova: str = ""
    origem: str = "Prova"
    etapa_pipeline: str | None = None


class ProcessCandidateStatusUpdateRequest(BaseSchema):
    status_candidato: str = ""
    data_movimentacao: str | None = None
    etapa_pipeline: str | None = None


class TalentBankUseRequest(BaseSchema):
    id_processo: str = ""


class CvPreAnalysisUpdateRequest(BaseSchema):
    nome_candidato: str = ""
    email: str = ""
    telefone: str = ""
    whatsapp: str = ""
