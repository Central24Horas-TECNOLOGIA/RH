from __future__ import annotations

import re

from pydantic import Field, field_validator, model_validator

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
            raise ValueError("Preencha os campos obrigatórios do processo.")
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
            raise ValueError("Informe um link de agendamento válido.")
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
    observacoes_publicas_vaga: str | None = None
    requisitos_publicos: str | None = None
    responsabilidades_publicas: str | None = None

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
            raise ValueError("Informe um link de agendamento válido.")
        return safe_value

    @field_validator("observacoes_publicas_vaga")
    @classmethod
    def validate_public_observation(cls, value: str | None) -> str | None:
        if value is None:
            return value
        safe_value = str(value or "").strip()
        if len(safe_value) > 3000:
            raise ValueError("As observações específicas da vaga devem ter no máximo 3000 caracteres.")
        return safe_value

    @field_validator("requisitos_publicos", "responsabilidades_publicas")
    @classmethod
    def validate_public_checkbox_config(cls, value: str | None) -> str | None:
        if value is None:
            return value
        safe_value = str(value or "").strip()
        if len(safe_value) > 8000:
            raise ValueError("A configuração da página pública deve ter no máximo 8000 caracteres por seção.")
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
    mensagem_aprovacao: str = ""
    data_comparecimento_aprovacao: str = ""
    documentos_aprovacao: list[str] = Field(default_factory=list)
    anexo_aprovacao_nome: str = ""
    anexo_aprovacao_tipo: str = ""
    anexo_aprovacao_tamanho: int = 0
    anexo_aprovacao_base64: str = ""
    motivo_eliminacao: str = ""
    etapa_eliminacao: str = ""
    data_eliminacao: str | None = None

    @field_validator("mensagem_aprovacao")
    @classmethod
    def validate_approval_message(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if len(safe_value) > 8000:
            raise ValueError("A mensagem de aprovação deve ter no máximo 8000 caracteres.")
        return safe_value

    @field_validator("documentos_aprovacao")
    @classmethod
    def validate_approval_documents(cls, value: list[str]) -> list[str]:
        documents = [str(item or "").strip() for item in (value or []) if str(item or "").strip()]
        if len(documents) > 40:
            raise ValueError("Selecione no máximo 40 documentos para aprovação.")
        return documents

    @field_validator("anexo_aprovacao_nome", "anexo_aprovacao_tipo")
    @classmethod
    def validate_approval_attachment_text(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if len(safe_value) > 255:
            raise ValueError("Os dados do anexo de aprovação são muito longos.")
        return safe_value

    @field_validator("anexo_aprovacao_tamanho")
    @classmethod
    def validate_approval_attachment_size(cls, value: int) -> int:
        safe_value = int(value or 0)
        if safe_value < 0:
            raise ValueError("Tamanho de anexo inválido.")
        if safe_value > 10 * 1024 * 1024:
            raise ValueError("O anexo da aprovação deve ter no máximo 10 MB.")
        return safe_value

    @field_validator("anexo_aprovacao_base64")
    @classmethod
    def validate_approval_attachment_content(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        max_base64_length = 14 * 1024 * 1024
        if len(safe_value) > max_base64_length:
            raise ValueError("O anexo da aprovação excede o tamanho permitido.")
        return safe_value

    @field_validator("motivo_eliminacao", "etapa_eliminacao")
    @classmethod
    def validate_elimination_text(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if len(safe_value) > 120:
            raise ValueError("Os dados da eliminacao devem ter no maximo 120 caracteres.")
        return safe_value


class StandaloneCandidateStatusUpdateRequest(BaseSchema):
    status_candidato: str = ""
    data_movimentacao: str | None = None
    mensagem_aprovacao: str = ""
    data_comparecimento_aprovacao: str = ""
    documentos_aprovacao: list[str] = Field(default_factory=list)
    anexo_aprovacao_nome: str = ""
    anexo_aprovacao_tipo: str = ""
    anexo_aprovacao_tamanho: int = 0
    anexo_aprovacao_base64: str = ""
    motivo_eliminacao: str = ""
    etapa_eliminacao: str = ""
    data_eliminacao: str | None = None


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


class TalentBankCreateRequest(BaseSchema):
    id_teste: str = ""
    id_processo: str = ""
    id_processo_ref: str = ""
    nome_candidato: str = ""
    vaga: str = ""
    pontuacao_final: str | float | int = ""
    data_movimentacao: str = ""
    origem: str = "Processo Unico"
    email: str = ""
    telefone: str = ""
    whatsapp: str = ""
    cidade: str = ""
    bairro: str = ""

    @field_validator("id_teste")
    @classmethod
    def validate_test_id(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if not safe_value:
            raise ValueError("Informe o ID da prova do candidato.")
        return safe_value

    @field_validator("nome_candidato")
    @classmethod
    def validate_candidate_name(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if not safe_value:
            raise ValueError("Informe o nome do candidato.")
        return safe_value


class CvPreAnalysisUpdateRequest(BaseSchema):
    nome_candidato: str = ""
    email: str = ""
    telefone: str = ""
    whatsapp: str = ""

    @field_validator("nome_candidato")
    @classmethod
    def validate_candidate_name(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if not safe_value:
            raise ValueError("Informe o nome do candidato.")
        return safe_value

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if safe_value and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", safe_value):
            raise ValueError("Informe um e-mail válido.")
        return safe_value

    @field_validator("telefone", "whatsapp")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        digits = re.sub(r"\D", "", safe_value)
        if safe_value and len(digits) not in (10, 11, 12, 13):
            raise ValueError("Informe um telefone ou WhatsApp válido.")
        return safe_value


class CandidateProfileUpdateRequest(BaseSchema):
    nome_candidato: str = ""
    habilidades: list[str] = []
    tags: list[str] = []
    observacao_rh: str = ""
    email: str = ""
    telefone: str = ""
    whatsapp: str = ""
    cidade: str = ""
    bairro: str = ""

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
            raise ValueError("A observação RH deve ter no máximo 3000 caracteres.")
        return safe_value

    @field_validator("email")
    @classmethod
    def validate_profile_email(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if safe_value and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", safe_value):
            raise ValueError("Informe um e-mail válido.")
        return safe_value

    @field_validator("telefone", "whatsapp")
    @classmethod
    def validate_profile_phone(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        digits = re.sub(r"\D", "", safe_value)
        if safe_value and len(digits) not in (10, 11, 12, 13):
            raise ValueError("Informe um telefone ou WhatsApp válido.")
        return safe_value

    @field_validator("cidade", "bairro")
    @classmethod
    def validate_location(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if len(safe_value) > 120:
            raise ValueError("Cidade e bairro devem ter no máximo 120 caracteres.")
        return safe_value
