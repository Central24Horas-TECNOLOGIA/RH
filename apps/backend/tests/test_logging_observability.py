from __future__ import annotations

import json
import logging

from fastapi import FastAPI
from fastapi.testclient import TestClient

from conecta.infrastructure.observability.context import request_id_var
from conecta.interfaces.http.middlewares.request_context import (
    RequestContextMiddleware,
    REQUEST_ID_PATTERN,
)
from rh_api.logging_config import JsonFormatter, configure_logging


def _build_app() -> FastAPI:
    app = FastAPI()
    app.add_middleware(RequestContextMiddleware)

    @app.get("/probe")
    def probe():
        return {"request_id_in_context": request_id_var.get()}

    return app


def test_request_context_middleware_generates_and_propagates_request_id():
    client = TestClient(_build_app())

    response = client.get("/probe")

    assert response.status_code == 200
    header_request_id = response.headers.get("X-Request-ID")
    assert header_request_id
    assert REQUEST_ID_PATTERN.fullmatch(header_request_id)
    # The value seen inside the endpoint (via the contextvar) must match the
    # id returned to the client, proving propagation through the request.
    assert response.json()["request_id_in_context"] == header_request_id


def test_request_context_middleware_honours_valid_incoming_request_id():
    client = TestClient(_build_app())

    response = client.get("/probe", headers={"X-Request-ID": "meu-id-123"})

    assert response.headers["X-Request-ID"] == "meu-id-123"
    assert response.json()["request_id_in_context"] == "meu-id-123"


def test_request_context_middleware_rejects_malformed_incoming_request_id():
    client = TestClient(_build_app())

    response = client.get("/probe", headers={"X-Request-ID": "id com espaco/ruim"})

    generated = response.headers["X-Request-ID"]
    assert generated != "id com espaco/ruim"
    assert REQUEST_ID_PATTERN.fullmatch(generated)


def test_json_formatter_emits_valid_json_with_expected_fields():
    formatter = JsonFormatter(service="conecta-api-test", environment="test", version="0.0.0")
    record = logging.LogRecord(
        name="conecta.test",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="evento de teste",
        args=(),
        exc_info=None,
    )

    payload = json.loads(formatter.format(record))

    assert payload["level"] == "INFO"
    assert payload["service"] == "conecta-api-test"
    assert payload["logger"] == "conecta.test"
    assert payload["message"] == "evento de teste"
    assert "timestamp" in payload
    assert "request_id" in payload


def test_configure_logging_installs_json_formatter_on_root_logger():
    configure_logging()

    root = logging.getLogger()
    assert root.handlers, "configure_logging deve instalar ao menos um handler"
    assert isinstance(root.handlers[0].formatter, JsonFormatter)
