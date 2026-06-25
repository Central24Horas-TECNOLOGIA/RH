from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

from ...domain.candidatos import CandidateStatus, decide_candidate_status


class CandidateGateway(Protocol):
    def create(self, data: dict[str, Any]) -> dict[str, Any]: ...
    def update(self, candidate_id: str, data: dict[str, Any]) -> dict[str, Any]: ...
    def change_status(self, candidate_id: str, data: dict[str, Any]) -> dict[str, Any]: ...


@dataclass
class CandidateUseCases:
    gateway: CandidateGateway

    def create_candidate(self, data: dict[str, Any]) -> dict[str, Any]:
        return self.gateway.create(data)

    def edit_candidate(self, candidate_id: str, data: dict[str, Any]) -> dict[str, Any]:
        return self.gateway.update(candidate_id, data)

    def qualify_candidate(self, candidate_id: str, reason: str = "") -> dict[str, Any]:
        return self._change(candidate_id, CandidateStatus.QUALIFIED, reason)

    def eliminate_candidate(self, candidate_id: str, reason: str) -> dict[str, Any]:
        return self._change(candidate_id, CandidateStatus.ELIMINATED, reason)

    def approve_candidate(self, candidate_id: str, reason: str = "") -> dict[str, Any]:
        return self._change(candidate_id, CandidateStatus.APPROVED, reason)

    def move_to_talent_bank(self, candidate_id: str, reason: str = "") -> dict[str, Any]:
        return self._change(candidate_id, CandidateStatus.TALENT_BANK, reason)

    def _change(self, candidate_id: str, status: CandidateStatus, reason: str) -> dict[str, Any]:
        decision = decide_candidate_status(status, reason)
        return self.gateway.change_status(
            candidate_id,
            {"status": decision.status.value, "justificativa": decision.reason},
        )
