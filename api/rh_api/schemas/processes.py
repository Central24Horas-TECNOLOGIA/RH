from __future__ import annotations

from pydantic import field_validator, model_validator

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
    link_agendamento: str = ""

    @field_validator("id_processo", "vaga", "data_encerramento")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if not safe_value:
            raise ValueError("Preencha os campos obrigatorios do processo.")
        return safe_value

    @field_validator("quantidade_vagas")
    @classmethod
    def validate_quantity(cls, value: int) -> int:
        if int(value or 0) <= 0:
            raise ValueError("A quantidade de vagas deve ser maior que zero.")
        return int(value)

    @field_validator("link_agendamento")
    @classmethod
    def validate_scheduling_link(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if safe_value and not safe_value.lower().startswith(("http://", "https://")):
            raise ValueError("Informe um link de agendamento valido.")
        return safe_value

    @model_validator(mode="after")
    def validate_cutoff(self):
        if int(self.usa_nota_corte or 0) == 1:
            if self.nota_corte is None or float(self.nota_corte) < 4 or float(self.nota_corte) > 10:
                raise ValueError("A nota de corte deve estar entre 4 e 10.")
        return self


class ProcessUpdateRequest(BaseSchema):
    quantidade_vagas: int = 0
    data_encerramento: str = ""
    operacao: str = ""
    trilha: str = ""
    usa_nota_corte: int = 0
    nota_corte: float | None = None
    status: str = "Aberto"
    link_agendamento: str = ""

    @field_validator("data_encerramento")
    @classmethod
    def validate_closing_date(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if not safe_value:
            raise ValueError("Informe a data de encerramento do processo.")
        return safe_value

    @field_validator("quantidade_vagas")
    @classmethod
    def validate_quantity(cls, value: int) -> int:
        if int(value or 0) <= 0:
            raise ValueError("A quantidade de vagas deve ser maior que zero.")
        return int(value)

    @field_validator("link_agendamento")
    @classmethod
    def validate_scheduling_link(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if safe_value and not safe_value.lower().startswith(("http://", "https://")):
            raise ValueError("Informe um link de agendamento valido.")
        return safe_value

    @model_validator(mode="after")
    def validate_cutoff(self):
        if int(self.usa_nota_corte or 0) == 1:
            if self.nota_corte is None or float(self.nota_corte) < 4 or float(self.nota_corte) > 10:
                raise ValueError("A nota de corte deve estar entre 4 e 10.")
        return self


class ProcessCandidateCreateRequest(BaseSchema):
    id_registro: int | None = None
    id_entrevista: int | None = None
    id_processo: str = ""
    id_processo_ref: str = ""
    id_teste: str = ""
    nome_candidato: str = ""
    vaga: str = ""
    status_candidato: str = "Analise"
    pontuacao_final: str | float | int = ""
    data_prova: str = ""
    origem: str = "Prova"
    etapa_pipeline: str | None = None

    @field_validator("nome_candidato")
    @classmethod
    def validate_candidate_name(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if not safe_value:
            raise ValueError("Informe o nome do candidato.")
        return safe_value


class ProcessCandidateStatusUpdateRequest(BaseSchema):
    status_candidato: str = ""
    data_movimentacao: str | None = None
    etapa_pipeline: str | None = None


class TalentBankUseRequest(BaseSchema):
    id_processo: str = ""
    id_processo_ref: str = ""

    @field_validator("id_processo")
    @classmethod
    def validate_process_id(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if not safe_value:
            raise ValueError("Selecione um processo para utilizar o candidato.")
        return safe_value


class CvPreAnalysisUpdateRequest(BaseSchema):
    nome_candidato: str = ""
    email: str = ""
    telefone: str = ""
    whatsapp: str = ""


class CandidateProfileUpdateRequest(BaseSchema):
    nome_candidato: str = ""
    habilidades: list[str] = []
    tags: list[str] = []
    observacao_rh: str = ""

    @field_validator("habilidades", "tags")
    @classmethod
    def validate_list_payload(cls, value: list[str]) -> list[str]:
        safe_items = [str(item or "").strip() for item in value if str(item or "").strip()]
        if len(safe_items) > 30:
            raise ValueError("Limite de 30 itens por campo.")
        return safe_items

    @field_validator("observacao_rh")
    @classmethod
    def validate_observation(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if len(safe_value) > 3000:
            raise ValueError("A observacao RH deve ter no maximo 3000 caracteres.")
        return safe_value
