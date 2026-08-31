from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from rh_api.routers import system as system_routes


def _build_client() -> TestClient:
    app = FastAPI()
    app.include_router(system_routes.router)
    return TestClient(app)


def test_api_status_requires_authentication():
    client = _build_client()
    resposta = client.get("/api/status")
    assert resposta.status_code == 401


def test_version_requires_authentication():
    client = _build_client()
    resposta = client.get("/version")
    assert resposta.status_code == 401


def test_health_remains_public_for_orchestrators():
    client = _build_client()
    resposta = client.get("/health")
    assert resposta.status_code == 200
    assert resposta.json()["status"] == "ok"
