from __future__ import annotations

from datetime import datetime

from .helpers import normalize_compare_text, normalize_text


PIPELINE_STAGES = ("Triagem", "Prova", "Entrevista", "Aprovado", "Reprovado")
NON_TERMINAL_PIPELINE_STAGES = {"Triagem", "Prova", "Entrevista"}


def normalize_pipeline_stage(stage: str | None) -> str:
    safe_stage = normalize_compare_text(stage)

    if safe_stage == "triagem":
        return "Triagem"
    if safe_stage == "prova":
        return "Prova"
    if safe_stage == "entrevista":
        return "Entrevista"
    if safe_stage == "aprovado":
        return "Aprovado"
    if safe_stage == "reprovado":
        return "Reprovado"

    return "Triagem"


def infer_pipeline_stage(
    status_candidato: str | None,
    origem: str | None,
    current_stage: str | None = None,
) -> str:
    status = normalize_compare_text(status_candidato)
    current = normalize_pipeline_stage(current_stage) if current_stage else None
    origem_normalizada = normalize_compare_text(origem)

    if status == "aprovado":
        return "Aprovado"

    if "eliminado" in status or status == "reprovado":
        return "Reprovado"

    if status == "prova":
        return "Prova"

    if status == "entrevista":
        return "Entrevista"

    if status == "triagem":
        return "Triagem"

    if current in PIPELINE_STAGES:
        return current

    if "pre-analise" in origem_normalizada or "pre analise" in origem_normalizada or "cv" in origem_normalizada:
        return "Triagem"

    if "prova" in origem_normalizada:
        return "Prova"

    return "Triagem"


def map_pipeline_stage_to_status(stage: str, current_status: str | None = None) -> str:
    normalized_stage = normalize_pipeline_stage(stage)
    current_status_safe = normalize_text(current_status)

    if normalized_stage in NON_TERMINAL_PIPELINE_STAGES:
        if normalize_compare_text(current_status_safe) == "banco de talentos":
            return "Banco de talentos"
        return "Em analise"

    if normalized_stage == "Aprovado":
        return "Aprovado"

    return "Eliminado no pipeline"


def build_pipeline_update_payload(stage: str, current_status: str | None = None) -> dict:
    normalized_stage = normalize_pipeline_stage(stage)
    return {
        "etapa_pipeline": normalized_stage,
        "status_candidato": map_pipeline_stage_to_status(normalized_stage, current_status),
        "data_movimentacao": datetime.now().isoformat(),
    }
