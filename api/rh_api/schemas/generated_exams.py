from __future__ import annotations

from typing import Any

from pydantic import Field

from .common import BaseSchema


class GeneratedExamCreateRequest(BaseSchema):
    candidato_id: str = ""
    id_teste: str = ""
    id_registro: int | None = None
    id_entrevista: int | None = None
    nome_candidato: str
    email: str = ""
    telefone: str = ""
    whatsapp: str = ""
    cpf: str = ""
    id_processo: str = ""
    id_processo_ref: str = ""
    vaga: str
    cargo: str = ""
    area: str = ""
    area_prova: str = ""
    operacao: str = ""
    trilha: str = ""
    nivel: str = ""
    tempo_total: int = Field(default=40, ge=1, le=300)
    tempo_minutos: int = Field(default=0, ge=0, le=300)
    quantidade_questoes: int = Field(default=0, ge=0)
    etapas: list[dict[str, Any]] = Field(default_factory=list)
    categorias: list[str] = Field(default_factory=list)
    questoes_snapshot: list[dict[str, Any]] = Field(default_factory=list)
    configuracao: dict[str, Any] = Field(default_factory=dict)
    personalizacao: dict[str, Any] = Field(default_factory=dict)
    perfil_vaga: str = ""
    tipo_avaliacao: str = ""
    observacoes_internas_rh: str = ""
    contexto_vaga: str = ""
    perfil_esperado: str = ""
    tom_prova: str = ""
    situacao_pratica_operacao: str = ""
    area_atuacao: str = ""
    instrucoes_especificas: str = ""
    instrucoes_operacao: str = ""
    expira_em: str = ""


class PublicExamAccessRequest(BaseSchema):
    email: str = ""
    telefone: str = ""
    codigo: str = ""


class PublicExamTokenRequest(BaseSchema):
    token: str


class PublicCandidateDataRequest(PublicExamTokenRequest):
    nome_candidato: str
    email: str
    telefone: str


class PublicExamAnswersRequest(PublicExamTokenRequest):
    respostas: list[Any] = Field(default_factory=list)
    finalizar_mesmo_assim: bool = False


class ManualEvaluationRequest(BaseSchema):
    nota_redacao: float | None = None
    nota_excel: float | None = None
    nota_tecnica: float | None = None
    nota_comunicacao: float | None = None
    nota_lgpd: float | None = None
    observacao: str = ""


class ReopenExamRequest(BaseSchema):
    motivo: str
    manter_respostas: bool = True


class CancelExamRequest(BaseSchema):
    motivo: str = ""


class DecisionRhRequest(BaseSchema):
    decisao: str
    justificativa: str = ""
    observacao: str = ""
    score_considerado: bool = True
