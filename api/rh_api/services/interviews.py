from __future__ import annotations

from datetime import datetime

from .helpers import normalize_compare_text, normalize_text
from .process_flow import (
    CANDIDATE_STATUS_APPROVED,
    CANDIDATE_STATUS_ATTENDED,
    CANDIDATE_STATUS_CONFIRMED,
    CANDIDATE_STATUS_ELIMINATED,
    CANDIDATE_STATUS_MISSED,
    CANDIDATE_STATUS_RESCHEDULED,
    CANDIDATE_STATUS_SCHEDULED,
    CANDIDATE_STATUS_TALENT_BANK,
)


INTERVIEW_STATUSES = (
    CANDIDATE_STATUS_SCHEDULED,
    CANDIDATE_STATUS_CONFIRMED,
    CANDIDATE_STATUS_RESCHEDULED,
    CANDIDATE_STATUS_ATTENDED,
    CANDIDATE_STATUS_MISSED,
    CANDIDATE_STATUS_APPROVED,
    CANDIDATE_STATUS_ELIMINATED,
    CANDIDATE_STATUS_TALENT_BANK,
)


def normalize_interview_status(status: str | None) -> str:
    safe_status = normalize_compare_text(status)

    if safe_status == "agendado":
        return "Agendado"
    if safe_status == "entrevista agendada":
        return "Agendado"
    if safe_status == "confirmado":
        return "Confirmado"
    if safe_status == "reagendado":
        return "Reagendado"
    if safe_status == "compareceu":
        return "Compareceu"
    if safe_status == "faltou":
        return "Faltou"
    if safe_status == "aprovado":
        return CANDIDATE_STATUS_APPROVED
    if safe_status == "banco de talentos":
        return CANDIDATE_STATUS_TALENT_BANK
    if safe_status == "reprovado" or "eliminado" in safe_status:
        return CANDIDATE_STATUS_ELIMINATED

    return "Agendado"


def format_interview_datetime(value: str | datetime | None) -> str:
    if value is None:
        return ""

    if isinstance(value, datetime):
        interview_date = value
    else:
        safe_value = normalize_text(value)
        if not safe_value:
            return ""

        try:
            interview_date = datetime.fromisoformat(safe_value)
        except ValueError:
            return safe_value

    return interview_date.strftime("%d/%m/%Y \u00e0s %H:%M")


def split_interview_datetime(value: str | datetime | None) -> tuple[str, str]:
    formatted = format_interview_datetime(value)
    separator = " \u00e0s "
    if separator not in formatted:
        return formatted or "data a confirmar", "horario a confirmar"

    date_label, time_label = formatted.split(separator, 1)
    return date_label, time_label


def build_interview_message(
    *,
    candidate_name: str,
    vacancy_name: str,
    interview_datetime: str | datetime | None,
    scheduling_link: str = "",
    custom_message: str = "",
) -> str:
    name = normalize_text(candidate_name)
    vacancy_label = normalize_text(vacancy_name)
    date_label, time_label = split_interview_datetime(interview_datetime)
    link = normalize_text(scheduling_link)
    custom_text = normalize_text(custom_message)

    if not name or not vacancy_label or not interview_datetime:
        return ""

    message_lines = [
        (
            f"Ol\u00e1 {name}! Gostar\u00edamos de convoc\u00e1-lo para o nosso processo seletivo "
            f"para a vaga de: {vacancy_label} no dia {date_label} \u00e0s {time_label}. "
            "Nosso endere\u00e7o fica na Rua Victor Civita, 77 - Bloco 1, 3\u00b0 Andar. "
            "Se precisar de apoio, responda esta mensagem para o time de RH."
        ),
    ]

    if link:
        message_lines.append(f"Link de entrevista: {link}")

    if custom_text:
        message_lines.append(f"Observa\u00e7\u00e3o do RH: {custom_text}")

    return "\n".join(message_lines)
