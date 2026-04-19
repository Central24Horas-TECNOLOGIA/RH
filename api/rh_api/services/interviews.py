from __future__ import annotations

from datetime import datetime

from .helpers import normalize_compare_text, normalize_text


INTERVIEW_STATUSES = ("Agendado", "Confirmado", "Compareceu", "Faltou")


def normalize_interview_status(status: str | None) -> str:
    safe_status = normalize_compare_text(status)

    if safe_status == "agendado":
        return "Agendado"
    if safe_status == "confirmado":
        return "Confirmado"
    if safe_status == "compareceu":
        return "Compareceu"
    if safe_status == "faltou":
        return "Faltou"

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

    return interview_date.strftime("%d/%m/%Y às %H:%M")


def build_interview_message(
    *,
    candidate_name: str,
    process_id: str,
    vacancy_name: str,
    interview_datetime: str | datetime | None,
    scheduling_link: str,
) -> str:
    name = normalize_text(candidate_name) or "candidato(a)"
    process_label = normalize_text(process_id)
    vacancy_label = normalize_text(vacancy_name) or process_label or "processo seletivo"
    date_label = format_interview_datetime(interview_datetime) or "data a confirmar"
    link = normalize_text(scheduling_link)

    message_lines = [
        f"Olá, {name}.",
        f"Sua entrevista para a vaga/processo {vacancy_label} foi registrada para {date_label}.",
        "Por favor, confirme os dados e acesse o link abaixo no horário combinado.",
    ]

    if process_label:
        message_lines.insert(1, f"Processo: {process_label}.")

    if link:
        message_lines.append(f"Link de agendamento/entrevista: {link}")

    message_lines.append("Se precisar de apoio, responda esta mensagem para o time de RH.")
    return "\n".join(message_lines)
