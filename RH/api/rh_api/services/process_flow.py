from __future__ import annotations

from .helpers import normalize_compare_text, normalize_text


PROCESS_STATUS_CLOSED = "Encerrado"

CANDIDATE_STATUS_ANALYSIS = "Analise"
CANDIDATE_STATUS_QUALIFIED = "Qualificado"
CANDIDATE_STATUS_NOT_QUALIFIED = "Nao qualificado"
CANDIDATE_STATUS_SCHEDULED = "Agendado"
CANDIDATE_STATUS_CONFIRMED = "Confirmado"
CANDIDATE_STATUS_RESCHEDULED = "Reagendado"
CANDIDATE_STATUS_ATTENDED = "Compareceu"
CANDIDATE_STATUS_MISSED = "Faltou"
CANDIDATE_STATUS_WITHDREW = "Desistente"
CANDIDATE_STATUS_APPROVED = "Aprovado"
CANDIDATE_STATUS_ELIMINATED = "Eliminado"
CANDIDATE_STATUS_TALENT_BANK = "Banco de talentos"

INTERVIEW_OPERATIONAL_STATUSES = {
    CANDIDATE_STATUS_SCHEDULED,
    CANDIDATE_STATUS_CONFIRMED,
    CANDIDATE_STATUS_RESCHEDULED,
    CANDIDATE_STATUS_ATTENDED,
    CANDIDATE_STATUS_MISSED,
}

TERMINAL_CANDIDATE_STATUSES = {
    CANDIDATE_STATUS_NOT_QUALIFIED,
    CANDIDATE_STATUS_WITHDREW,
    CANDIDATE_STATUS_APPROVED,
    CANDIDATE_STATUS_ELIMINATED,
    CANDIDATE_STATUS_TALENT_BANK,
}

ACTIVE_CANDIDATE_STATUSES = {
    CANDIDATE_STATUS_ANALYSIS,
    CANDIDATE_STATUS_QUALIFIED,
    CANDIDATE_STATUS_SCHEDULED,
    CANDIDATE_STATUS_CONFIRMED,
    CANDIDATE_STATUS_RESCHEDULED,
    CANDIDATE_STATUS_ATTENDED,
}

FINAL_DECISION_ALLOWED_STATUSES = {
    CANDIDATE_STATUS_ANALYSIS,
    CANDIDATE_STATUS_ATTENDED,
}

INTERVIEW_SCHEDULING_ALLOWED_STATUSES = {
    CANDIDATE_STATUS_QUALIFIED,
}


def normalize_process_status(status: str | None) -> str:
    safe_status = normalize_compare_text(status)
    if safe_status == "encerrado":
        return PROCESS_STATUS_CLOSED
    return normalize_text(status)


def is_process_closed(status: str | None) -> bool:
    return normalize_process_status(status) == PROCESS_STATUS_CLOSED


def canonicalize_candidate_status(status: str | None) -> str:
    safe_status = normalize_compare_text(status)
    if not safe_status:
        return CANDIDATE_STATUS_ANALYSIS

    if safe_status in {
        "analise",
        "em analise",
        "em processo",
        "sem processo vinculado",
        "processo unico",
        "processo_unico",
        "finalizado",
    }:
        return CANDIDATE_STATUS_ANALYSIS
    if safe_status == "qualificado":
        return CANDIDATE_STATUS_QUALIFIED
    if safe_status == "nao qualificado":
        return CANDIDATE_STATUS_NOT_QUALIFIED
    if safe_status == "agendado":
        return CANDIDATE_STATUS_SCHEDULED
    if safe_status == "entrevista agendada":
        return CANDIDATE_STATUS_SCHEDULED
    if safe_status == "confirmado":
        return CANDIDATE_STATUS_CONFIRMED
    if safe_status == "reagendado":
        return CANDIDATE_STATUS_RESCHEDULED
    if safe_status == "compareceu":
        return CANDIDATE_STATUS_ATTENDED
    if safe_status == "faltou":
        return CANDIDATE_STATUS_MISSED
    if safe_status == "desistente":
        return CANDIDATE_STATUS_WITHDREW
    if safe_status == "aprovado":
        return CANDIDATE_STATUS_APPROVED
    if safe_status == "banco de talentos":
        return CANDIDATE_STATUS_TALENT_BANK
    if safe_status == "reprovado" or "eliminado" in safe_status:
        return CANDIDATE_STATUS_ELIMINATED

    return normalize_text(status)


def get_candidate_visible_status(
    status_candidato: str | None,
    status_entrevista: str | None = None,
) -> str:
    candidate_status = canonicalize_candidate_status(status_candidato)
    interview_status = canonicalize_candidate_status(status_entrevista)

    if candidate_status in TERMINAL_CANDIDATE_STATUSES:
        return candidate_status
    if interview_status in INTERVIEW_OPERATIONAL_STATUSES:
        return interview_status
    return candidate_status


def is_terminal_candidate_status(status: str | None) -> bool:
    return canonicalize_candidate_status(status) in TERMINAL_CANDIDATE_STATUSES


def is_active_candidate_status(status: str | None) -> bool:
    return canonicalize_candidate_status(status) in ACTIVE_CANDIDATE_STATUSES


def status_allows_final_decision(status: str | None) -> bool:
    return canonicalize_candidate_status(status) in FINAL_DECISION_ALLOWED_STATUSES


def status_allows_interview_scheduling(status: str | None) -> bool:
    return canonicalize_candidate_status(status) in INTERVIEW_SCHEDULING_ALLOWED_STATUSES


def map_cv_classification_to_status(classification: str | None) -> str:
    safe_classification = normalize_compare_text(classification)
    if safe_classification in {"qualificado", "parcialmente qualificado"}:
        return CANDIDATE_STATUS_QUALIFIED
    return CANDIDATE_STATUS_NOT_QUALIFIED


def build_process_closed_message(action_label: str, id_processo: str | None = None) -> str:
    return "Processo encerrado. Movimentações não são permitidas."


def build_candidate_status_action_label(status: str | None) -> str:
    safe_status = canonicalize_candidate_status(status)

    if safe_status == CANDIDATE_STATUS_APPROVED:
        return "aprovar o candidato"
    if safe_status == CANDIDATE_STATUS_ELIMINATED:
        return "eliminar o candidato"
    if safe_status == CANDIDATE_STATUS_TALENT_BANK:
        return "enviar o candidato para banco de talentos"
    if safe_status in INTERVIEW_OPERATIONAL_STATUSES:
        return "atualizar o status operacional do candidato"

    return "movimentar o candidato"


def build_approved_candidate_locked_message() -> str:
    return "Este candidato já foi aprovado neste processo. Não há ações pendentes."


def build_terminal_candidate_locked_message(status: str | None = None) -> str:
    safe_status = canonicalize_candidate_status(status)
    if safe_status == CANDIDATE_STATUS_APPROVED:
        return build_approved_candidate_locked_message()
    return "Este candidato já está com status final neste processo. Não há ações pendentes."
