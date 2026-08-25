from __future__ import annotations

import re
import unicodedata
from datetime import date, datetime

from pydantic import Field, field_validator, model_validator

from .common import BaseSchema


def _normalize_compare_value(value: str) -> str:
    normalized = unicodedata.normalize("NFD", str(value or "").strip())
    normalized = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
    return normalized.lower()


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
    configuracao_prova_json: str | None = None
    prova_configurada_em: str | None = None
    urgente: bool = False

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

    @field_validator("configuracao_prova_json")
    @classmethod
    def validate_exam_config(cls, value: str | None) -> str | None:
        if value is None:
            return value
        safe_value = str(value or "").strip()
        if len(safe_value) > 200000:
            raise ValueError("A configuração da prova é muito longa.")
        return safe_value

    @model_validator(mode="after")
    def validate_cutoff(self):
        if int(self.usa_nota_corte or 0) == 1:
            if self.nota_corte is None or float(self.nota_corte) < 4 or float(self.nota_corte) > 10:
                raise ValueError("A nota de corte deve estar entre 4 e 10.")
        return self


class ProcessUpdateRequest(BaseSchema):
    vaga: str | None = None
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
    configuracao_prova_json: str | None = None
    prova_configurada_em: str | None = None
    urgente: bool | None = None

    @field_validator("data_encerramento")
    @classmethod
    def validate_closing_date(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if not safe_value:
            raise ValueError("Informe a data de encerramento do processo.")
        return safe_value

    @field_validator("vaga")
    @classmethod
    def validate_optional_vacancy(cls, value: str | None) -> str | None:
        if value is None:
            return value
        safe_value = str(value or "").strip()
        if not safe_value:
            raise ValueError("Informe o cargo/vaga do processo.")
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

    @field_validator("configuracao_prova_json")
    @classmethod
    def validate_exam_config(cls, value: str | None) -> str | None:
        if value is None:
            return value
        safe_value = str(value or "").strip()
        if len(safe_value) > 200000:
            raise ValueError("A configuração da prova é muito longa.")
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


class ProcessStateChangeRequest(BaseSchema):
    justificativa: str = ""
    tempo_pausa: str = ""
    pausa_previsao_termino: str = ""

    @field_validator("justificativa")
    @classmethod
    def validate_required_reason(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if len(safe_value) < 10:
            raise ValueError("Informe uma justificativa com pelo menos 10 caracteres.")
        if len(safe_value) > 3000:
            raise ValueError("A justificativa deve ter no máximo 3000 caracteres.")
        return safe_value

    @field_validator("tempo_pausa", "pausa_previsao_termino")
    @classmethod
    def validate_optional_pause_fields(cls, value: str) -> str:
        return str(value or "").strip()


class ProcessDossierNoteCreateRequest(BaseSchema):
    id_teste: str = ""
    nome_candidato: str = ""
    texto: str = ""

    @field_validator("texto")
    @classmethod
    def validate_note_text(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if not safe_value:
            raise ValueError("Informe a anotação do dossiê.")
        if len(safe_value) > 3000:
            raise ValueError("A anotação do dossiê deve ter no máximo 3000 caracteres.")
        return safe_value

    @field_validator("id_teste", "nome_candidato")
    @classmethod
    def validate_note_reference(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if len(safe_value) > 255:
            raise ValueError("A referência da anotação é muito longa.")
        return safe_value


class ProcessDossierNoteUpdateRequest(BaseSchema):
    texto: str = ""

    @field_validator("texto")
    @classmethod
    def validate_note_text(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if not safe_value:
            raise ValueError("Informe a anotação do dossiê.")
        if len(safe_value) > 3000:
            raise ValueError("A anotação do dossiê deve ter no máximo 3000 caracteres.")
        return safe_value


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
    eh_indicacao: bool = False
    tipo_indicacao: str = ""
    indicado_por: str = ""

    @field_validator("nome_candidato")
    @classmethod
    def validate_candidate_name(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if not safe_value:
            raise ValueError("Informe o nome do candidato.")
        return safe_value

    @field_validator("tipo_indicacao")
    @classmethod
    def validate_candidate_indication_type(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if not safe_value:
            return safe_value
        valid_values = {
            "indicado",
            "indicado com restricao",
            "indicado com restricoes",
            "contraindicado",
        }
        if _normalize_compare_value(safe_value) not in valid_values:
            raise ValueError("Tipo de indicação inválido.")
        return safe_value

    @model_validator(mode="after")
    def validate_candidate_indication(self):
        if self.eh_indicacao and not str(self.tipo_indicacao or "").strip():
            raise ValueError("Selecione o tipo de indicação.")
        return self

    @model_validator(mode="after")
    def validate_candidate_referral_origin(self):
        self.indicado_por = str(self.indicado_por or "").strip()
        if _normalize_compare_value(self.origem) == "indicacao" and not self.indicado_por:
            raise ValueError("Informe o nome de quem indicou o candidato.")
        return self


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
            raise ValueError("Os dados da eliminação devem ter no máximo 120 caracteres.")
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


class WhatsAppManualContactRequest(BaseSchema):
    tipo_contato: str = "contato_enviado"
    observacao: str = ""
    mensagem: str = ""

    @field_validator("tipo_contato")
    @classmethod
    def validate_contact_type(cls, value: str) -> str:
        safe_value = str(value or "").strip() or "contato_enviado"
        allowed = {
            "contato_enviado",
            "respondeu",
            "confirmou_entrevista",
            "cancelou_entrevista",
            "solicitou_reagendamento",
            "observacao_livre",
        }
        if safe_value not in allowed:
            raise ValueError("Tipo de contato WhatsApp inválido.")
        return safe_value

    @field_validator("observacao", "mensagem")
    @classmethod
    def validate_contact_text(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if len(safe_value) > 2000:
            raise ValueError("O texto do registro de WhatsApp deve ter no máximo 2000 caracteres.")
        return safe_value


class TalentBankUseRequest(BaseSchema):
    id_processo: str = ""
    id_processo_ref: str = ""
    origem: str = ""
    eh_indicacao: bool = False
    tipo_indicacao: str = ""

    @field_validator("id_processo")
    @classmethod
    def validate_process_id(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if not safe_value:
            raise ValueError("Selecione um processo para utilizar o candidato.")
        return safe_value

    @field_validator("tipo_indicacao")
    @classmethod
    def validate_talent_bank_indication_type(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if not safe_value:
            return safe_value
        valid_values = {
            "indicado",
            "indicado com restricao",
            "indicado com restricoes",
            "contraindicado",
        }
        if _normalize_compare_value(safe_value) not in valid_values:
            raise ValueError("Tipo de indicação inválido.")
        return safe_value

    @model_validator(mode="after")
    def validate_talent_bank_indication(self):
        if self.eh_indicacao and not str(self.tipo_indicacao or "").strip():
            raise ValueError("Selecione o tipo de indicação.")
        return self


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
    codigo_acesso: str = ""
    codigo_cp: str = ""
    codigo_prova: str = ""
    eh_indicacao: bool = False
    tipo_indicacao: str = ""

    @field_validator("id_teste")
    @classmethod
    def validate_test_id(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if not safe_value:
            raise ValueError("Informe o ID da prova do candidato.")
        return safe_value

    @field_validator("tipo_indicacao")
    @classmethod
    def validate_create_indication_type(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if not safe_value:
            return safe_value
        valid_values = {
            "indicado",
            "indicado com restricao",
            "indicado com restricoes",
            "contraindicado",
        }
        if _normalize_compare_value(safe_value) not in valid_values:
            raise ValueError("Tipo de indicação inválido.")
        return safe_value

    @model_validator(mode="after")
    def validate_create_indication(self):
        if self.eh_indicacao and not str(self.tipo_indicacao or "").strip():
            raise ValueError("Selecione o tipo de indicação.")
        return self

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
    classificacao_indicacao: str = ""
    justificativa_indicacao: str = ""
    email: str = ""
    telefone: str = ""
    whatsapp: str = ""
    endereco: str = ""
    cidade: str = ""
    bairro: str = ""
    data_nascimento: str = ""
    escolaridade: str = ""
    possui_experiencia: str = ""
    musica: str = ""
    prato: str = ""
    futebol: str = ""
    time: str = ""
    rede_social: str = ""

    @field_validator("data_nascimento")
    @classmethod
    def validate_profile_birth_date(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if not safe_value:
            return safe_value
        try:
            parsed = datetime.strptime(safe_value[:10], "%Y-%m-%d").date()
        except ValueError:
            raise ValueError("Informe uma data de nascimento válida.")
        if parsed > date.today():
            raise ValueError("A data de nascimento não pode estar no futuro.")
        return parsed.isoformat()

    @field_validator("habilidades", "tags")
    @classmethod
    def validate_list_payload(cls, value: list[str]) -> list[str]:
        safe_items = [str(item or "").strip() for item in value if str(item or "").strip()]
        if len(safe_items) > 30:
            raise ValueError("Limite de 30 itens por campo.")
        return safe_items

    @field_validator("observacao_rh", "justificativa_indicacao")
    @classmethod
    def validate_observation(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if len(safe_value) > 3000:
            raise ValueError("A observação RH deve ter no máximo 3000 caracteres.")
        return safe_value

    @field_validator("classificacao_indicacao")
    @classmethod
    def validate_profile_recommendation(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if not safe_value:
            return safe_value
        valid_values = {
            "indicado",
            "indicado com restricoes",
            "contraindicado",
        }
        if _normalize_compare_value(safe_value) not in valid_values:
            raise ValueError("Classificação da ficha do candidato inválida.")
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

    @field_validator("endereco", "escolaridade", "musica", "prato", "futebol", "time")
    @classmethod
    def validate_profile_text(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if len(safe_value) > 255:
            raise ValueError("Campo da ficha muito longo.")
        return safe_value

    @field_validator("rede_social")
    @classmethod
    def validate_profile_social(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if len(safe_value) > 500:
            raise ValueError("Rede social deve ter no maximo 500 caracteres.")
        return safe_value

    @field_validator("possui_experiencia")
    @classmethod
    def validate_profile_experience(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if safe_value and _normalize_compare_value(safe_value) not in {"sim", "nao"}:
            raise ValueError("Possui experiencia deve ser Sim ou Nao.")
        return safe_value

    @field_validator("cidade", "bairro")
    @classmethod
    def validate_location(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if len(safe_value) > 120:
            raise ValueError("Cidade e bairro devem ter no máximo 120 caracteres.")
        return safe_value


class CandidateSheetUpdateRequest(BaseSchema):
    nome_candidato: str | None = None
    email: str | None = None
    telefone: str | None = None
    whatsapp: str | None = None
    endereco: str | None = None
    cidade: str | None = None
    bairro: str | None = None
    data_nascimento: str | None = None
    escolaridade: str | None = None
    possui_experiencia: str | None = None
    musica: str | None = None
    prato: str | None = None
    futebol: str | None = None
    time: str | None = None
    rede_social: str | None = None
    observacao_rh: str | None = None
    classificacao: str | None = None
    classificacao_indicacao: str | None = None
    justificativa: str | None = None
    justificativa_indicacao: str | None = None

    @field_validator("data_nascimento")
    @classmethod
    def validate_sheet_birth_date(cls, value: str | None) -> str | None:
        if value is None:
            return value
        safe_value = str(value or "").strip()
        if not safe_value:
            return safe_value
        try:
            parsed = datetime.strptime(safe_value[:10], "%Y-%m-%d").date()
        except ValueError:
            raise ValueError("Informe uma data de nascimento válida.")
        if parsed > date.today():
            raise ValueError("A data de nascimento não pode estar no futuro.")
        return parsed.isoformat()

    @field_validator("nome_candidato")
    @classmethod
    def validate_optional_candidate_name(cls, value: str | None) -> str | None:
        if value is None:
            return value
        safe_value = str(value or "").strip()
        if len(safe_value) > 255:
            raise ValueError("O nome do candidato deve ter no máximo 255 caracteres.")
        return safe_value

    @field_validator("email")
    @classmethod
    def validate_sheet_email(cls, value: str | None) -> str | None:
        if value is None:
            return value
        safe_value = str(value or "").strip()
        if safe_value and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", safe_value):
            raise ValueError("Informe um e-mail válido.")
        return safe_value

    @field_validator("telefone", "whatsapp")
    @classmethod
    def validate_sheet_phone(cls, value: str | None) -> str | None:
        if value is None:
            return value
        safe_value = str(value or "").strip()
        digits = re.sub(r"\D", "", safe_value)
        if safe_value and len(digits) not in (10, 11, 12, 13):
            raise ValueError("Informe um telefone ou WhatsApp válido.")
        return safe_value

    @field_validator("endereco", "escolaridade", "musica", "prato", "futebol", "time")
    @classmethod
    def validate_sheet_text(cls, value: str | None) -> str | None:
        if value is None:
            return value
        safe_value = str(value or "").strip()
        if len(safe_value) > 255:
            raise ValueError("Campo da ficha muito longo.")
        return safe_value

    @field_validator("rede_social")
    @classmethod
    def validate_sheet_social(cls, value: str | None) -> str | None:
        if value is None:
            return value
        safe_value = str(value or "").strip()
        if len(safe_value) > 500:
            raise ValueError("Rede social deve ter no maximo 500 caracteres.")
        return safe_value

    @field_validator("possui_experiencia")
    @classmethod
    def validate_sheet_experience(cls, value: str | None) -> str | None:
        if value is None:
            return value
        safe_value = str(value or "").strip()
        if safe_value and _normalize_compare_value(safe_value) not in {"sim", "nao"}:
            raise ValueError("Possui experiencia deve ser Sim ou Nao.")
        return safe_value

    @field_validator("cidade", "bairro")
    @classmethod
    def validate_sheet_location(cls, value: str | None) -> str | None:
        if value is None:
            return value
        safe_value = str(value or "").strip()
        if len(safe_value) > 120:
            raise ValueError("Cidade e bairro devem ter no máximo 120 caracteres.")
        return safe_value

    @field_validator("observacao_rh", "justificativa", "justificativa_indicacao")
    @classmethod
    def validate_sheet_long_text(cls, value: str | None) -> str | None:
        if value is None:
            return value
        safe_value = str(value or "").strip()
        if len(safe_value) > 3000:
            raise ValueError("Os textos da ficha devem ter no máximo 3000 caracteres.")
        return safe_value

    @field_validator("classificacao", "classificacao_indicacao")
    @classmethod
    def validate_sheet_recommendation(cls, value: str | None) -> str | None:
        if value is None:
            return value
        safe_value = str(value or "").strip()
        if not safe_value:
            return safe_value
        valid_values = {
            "indicado",
            "indicado com restricoes",
            "contraindicado",
        }
        if _normalize_compare_value(safe_value) not in valid_values:
            raise ValueError("Classificação da ficha do candidato inválida.")
        return safe_value
