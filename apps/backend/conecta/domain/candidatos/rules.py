from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class CandidateStatus(StrEnum):
    QUALIFIED = "Qualificado"
    ELIMINATED = "Eliminado"
    APPROVED = "Aprovado"
    TALENT_BANK = "Banco de talentos"


@dataclass(frozen=True)
class CandidateDecision:
    status: CandidateStatus
    reason: str = ""


def decide_candidate_status(status: CandidateStatus, reason: str = "") -> CandidateDecision:
    safe_reason = str(reason or "").strip()
    if status is CandidateStatus.ELIMINATED and not safe_reason:
        raise ValueError("A eliminação de candidato exige uma justificativa.")
    return CandidateDecision(status=status, reason=safe_reason)
