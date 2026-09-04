from __future__ import annotations

from datetime import datetime

from pydantic import field_validator

from .common import BaseSchema


class OnboardingTrilhaItemInput(BaseSchema):
    titulo: str = ""
    descricao: str = ""
    ordem: int = 0
    obrigatorio: bool = True
    tipo_conteudo: str = ""
    conteudo_url: str = ""

    @field_validator("titulo")
    @classmethod
    def validate_titulo(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if not safe_value:
            raise ValueError("Informe o título do item da trilha.")
        if len(safe_value) > 255:
            raise ValueError("O título do item deve ter no máximo 255 caracteres.")
        return safe_value


class OnboardingTrilhaCreateRequest(BaseSchema):
    nome: str = ""
    descricao: str = ""
    ativo: bool = True
    categoria: str = "Onboarding"
    id_operacao: int | None = None
    modalidade: str = ""
    local_padrao: str = ""
    conteudo_json: str | None = None
    itens: list[OnboardingTrilhaItemInput] = []

    @field_validator("nome")
    @classmethod
    def validate_nome(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if not safe_value:
            raise ValueError("Informe o nome da trilha de onboarding.")
        if len(safe_value) > 255:
            raise ValueError("O nome da trilha deve ter no máximo 255 caracteres.")
        return safe_value

    @field_validator("conteudo_json")
    @classmethod
    def validate_conteudo_json(cls, value: str | None) -> str | None:
        if value is None:
            return value
        safe_value = str(value or "").strip()
        if len(safe_value) > 200000:
            raise ValueError("O conteúdo do treinamento é muito longo.")
        return safe_value


class OnboardingTrilhaUpdateRequest(OnboardingTrilhaCreateRequest):
    pass


class OnboardingStartRequest(BaseSchema):
    id_registro: int
    trilha_id: int
    data_prevista: datetime | None = None
    local: str = ""
    ministrante: str = ""

    @field_validator("id_registro", "trilha_id")
    @classmethod
    def validate_ids(cls, value: int) -> int:
        if not value or int(value) <= 0:
            raise ValueError("Identificador inválido.")
        return int(value)


class OnboardingItemToggleRequest(BaseSchema):
    concluido: bool = True


class OnboardingAssignmentUpdateRequest(BaseSchema):
    data_prevista: datetime | None = None
    local: str = ""
    ministrante: str = ""
    status: str = "em_andamento"
    acesso_plataforma: bool = False
    metodo_login: str = ""


class OnboardingAttendanceEntry(BaseSchema):
    id_onboarding: int
    presente: bool = False


class OnboardingAttendanceRequest(BaseSchema):
    presencas: list[OnboardingAttendanceEntry] = []


class ProcessTrainingReleaseRequest(BaseSchema):
    candidatos: list[int] = []

    @field_validator("candidatos")
    @classmethod
    def validate_candidatos(cls, value: list[int]) -> list[int]:
        safe_ids = [int(item) for item in (value or []) if item]
        if not safe_ids:
            raise ValueError("Selecione ao menos um candidato para liberar o treinamento.")
        if len(safe_ids) > 200:
            raise ValueError("Limite de 200 candidatos por liberação.")
        return safe_ids
