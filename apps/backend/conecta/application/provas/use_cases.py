from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol


class ExamGateway(Protocol):
    def generate(self, data: dict[str, Any]) -> dict[str, Any]: ...
    def grade(self, exam_id: int, data: dict[str, Any]) -> dict[str, Any]: ...
    def reopen(self, exam_id: int, data: dict[str, Any]) -> dict[str, Any]: ...


@dataclass
class ExamUseCases:
    gateway: ExamGateway

    def generate_exam(self, data: dict[str, Any]) -> dict[str, Any]:
        return self.gateway.generate(data)

    def grade_exam(self, exam_id: int, data: dict[str, Any]) -> dict[str, Any]:
        return self.gateway.grade(exam_id, data)

    def reopen_exam(self, exam_id: int, reason: str) -> dict[str, Any]:
        safe_reason = str(reason or "").strip()
        if not safe_reason:
            raise ValueError("A reabertura de prova exige uma justificativa.")
        return self.gateway.reopen(exam_id, {"justificativa": safe_reason})
