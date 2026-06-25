from dataclasses import dataclass
from typing import Any, Protocol


class AuditGateway(Protocol):
    def record_audit_log(self, **event: Any) -> None: ...


@dataclass
class AuditUseCases:
    gateway: AuditGateway

    def register(self, **event: Any) -> None:
        self.gateway.record_audit_log(**event)
