from __future__ import annotations

from datetime import datetime

from pydantic import field_validator, model_validator

from ..services.interviews import normalize_interview_status
from .common import BaseSchema


class InterviewCreateRequest(BaseSchema):
    id_registro: int
    id_slot: int | None = None
    id_processo: str = ""
    id_processo_ref: str = ""
    data_entrevista: datetime | None = None
    status_entrevista: str = "Agendado"
    link_agendamento: str = ""
    observacoes_rh: str = ""

    @field_validator("id_registro")
    @classmethod
    def validate_record_id(cls, value: int) -> int:
        if int(value or 0) <= 0:
            raise ValueError("Selecione um candidato valido para agendar a entrevista.")
        return int(value)

    @field_validator("data_entrevista")
    @classmethod
    def validate_interview_date(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        if value < datetime.now():
            raise ValueError("A data da entrevista deve ser futura.")
        return value

    @field_validator("status_entrevista")
    @classmethod
    def validate_status(cls, value: str) -> str:
        return normalize_interview_status(value)

    @field_validator("link_agendamento")
    @classmethod
    def validate_link(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if safe_value and not safe_value.lower().startswith(("http://", "https://")):
            raise ValueError("Informe um link de agendamento valido.")
        return safe_value

    @field_validator("observacoes_rh")
    @classmethod
    def validate_notes(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if len(safe_value) > 2000:
            raise ValueError("As observacoes da entrevista devem ter no maximo 2000 caracteres.")
        return safe_value


class InterviewUpdateRequest(BaseSchema):
    id_slot: int | None = None
    data_entrevista: datetime | None = None
    status_entrevista: str | None = None
    link_agendamento: str | None = None
    observacoes_rh: str | None = None

    @field_validator("status_entrevista")
    @classmethod
    def validate_status(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return normalize_interview_status(value)

    @field_validator("link_agendamento")
    @classmethod
    def validate_link(cls, value: str | None) -> str | None:
        if value is None:
            return None

        safe_value = str(value or "").strip()
        if safe_value and not safe_value.lower().startswith(("http://", "https://")):
            raise ValueError("Informe um link de agendamento valido.")
        return safe_value

    @field_validator("observacoes_rh")
    @classmethod
    def validate_notes(cls, value: str | None) -> str | None:
        if value is None:
            return None

        safe_value = str(value or "").strip()
        if len(safe_value) > 2000:
            raise ValueError("As observacoes da entrevista devem ter no maximo 2000 caracteres.")
        return safe_value

    @model_validator(mode="after")
    def validate_payload(self):
        if (
            self.data_entrevista is None
            and self.id_slot is None
            and self.status_entrevista is None
            and self.link_agendamento is None
            and self.observacoes_rh is None
        ):
            raise ValueError("Informe ao menos um campo para atualizar a entrevista.")

        return self


class InterviewSlotCreateRequest(BaseSchema):
    id_processo: str = ""
    id_processo_ref: str = ""
    data: str
    hora_inicio: str
    hora_fim: str
    duracao_minutos: int = 30
    observacoes_rh: str = ""

    @field_validator("data", "hora_inicio", "hora_fim")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if not safe_value:
            raise ValueError("Informe data e faixa de horario para criar slots.")
        return safe_value

    @field_validator("duracao_minutos")
    @classmethod
    def validate_duration(cls, value: int) -> int:
        duration = int(value or 0)
        if duration < 5 or duration > 240:
            raise ValueError("A duracao do slot deve ficar entre 5 e 240 minutos.")
        return duration

    @field_validator("observacoes_rh")
    @classmethod
    def validate_notes(cls, value: str) -> str:
        safe_value = str(value or "").strip()
        if len(safe_value) > 2000:
            raise ValueError("As observacoes da disponibilidade devem ter no maximo 2000 caracteres.")
        return safe_value
