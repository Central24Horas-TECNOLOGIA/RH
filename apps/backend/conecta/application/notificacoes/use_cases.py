from dataclasses import dataclass
from typing import Any, Protocol


class NotificationGateway(Protocol):
    def send(self, data: dict[str, Any]) -> dict[str, Any]: ...


@dataclass
class NotificationUseCases:
    gateway: NotificationGateway

    def send_notification(self, data: dict[str, Any]) -> dict[str, Any]:
        return self.gateway.send(data)
