from __future__ import annotations

import logging
import json
from datetime import datetime, timezone

from .config import get_settings
from conecta.infrastructure.observability.context import (
    request_id_var,
    user_id_var,
)


class JsonFormatter(logging.Formatter):
    def __init__(self, *, service: str, environment: str, version: str) -> None:
        super().__init__()
        self.service = service
        self.environment = environment
        self.version = version

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "service": self.service,
            "environment": self.environment,
            "version": self.version,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": request_id_var.get(),
            "user_id": user_id_var.get(),
            "action": getattr(record, "action", ""),
            "status": getattr(record, "status", ""),
        }
        if hasattr(record, "duration_ms"):
            payload["duration_ms"] = record.duration_ms
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False, default=str)


def configure_logging() -> None:
    settings = get_settings()
    level_name = settings.log_level.upper()
    level = getattr(logging, level_name, logging.INFO)

    root = logging.getLogger()
    root.setLevel(level)
    if getattr(root, "_conecta_configured", False):
        return
    handler = logging.StreamHandler()
    handler.setFormatter(
        JsonFormatter(
            service=settings.service_name,
            environment=settings.app_env,
            version=settings.app_version,
        )
    )
    root.handlers.clear()
    root.addHandler(handler)
    root._conecta_configured = True
