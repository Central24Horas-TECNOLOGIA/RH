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
    process_id: str,
    vacancy_name: str,
    interview_datetime: str | datetime | None,
    scheduling_link: str = "",
) -> str:
    name = normalize_text(candidate_name) or "candidato(a)"
    process_label = normalize_text(process_id)
    vacancy_label = normalize_text(vacancy_name) or process_label or "processo seletivo"
    date_label, time_label = split_interview_datetime(interview_datetime)
    link = normalize_text(scheduling_link)

    message_lines = [
        f"Ol\u00e1 {name}, sua entrevista foi agendada para {date_label} \u00e0s {time_label}.",
        f"Vaga/processo: {vacancy_label}.",
    ]

    if process_label:
        message_lines.append(f"Processo: {process_label}.")

    if link:
        message_lines.append(f"Link de entrevista: {link}")

    message_lines.append("Se precisar de apoio, responda esta mensagem para o time de RH.")
    return "\n".join(message_lines)
