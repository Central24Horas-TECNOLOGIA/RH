from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol


class InterviewGateway(Protocol):
    def schedule(self, data: dict[str, Any]) -> dict[str, Any]: ...
    def cancel(self, interview_id: int, data: dict[str, Any]) -> dict[str, Any]: ...


@dataclass
class InterviewUseCases:
    gateway: InterviewGateway

    def schedule_interview(self, data: dict[str, Any]) -> dict[str, Any]:
        return self.gateway.schedule(data)

    def cancel_interview(self, interview_id: int, reason: str) -> dict[str, Any]:
        safe_reason = str(reason or "").strip()
        if not safe_reason:
            raise ValueError("O cancelamento de entrevista exige uma justificativa.")
        return self.gateway.cancel(interview_id, {"justificativa": safe_reason})
