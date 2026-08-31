from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from rh_api.config import get_settings
from rh_api.dependencies import get_repository
from rh_api.routers import generated_exams as generated_exams_routes


class _StubExamRepository:
    """Repositório falso: nunca acerta o código, só para exercitar o rate limiter."""

    def public_access_by_code(self, code: str) -> dict:
        return {"success": False, "message": "Código inválido ou prova indisponível.", "provas": []}


def _build_client() -> TestClient:
    app = FastAPI()
    app.include_router(generated_exams_routes.public_router)
    app.dependency_overrides[get_repository] = lambda: _StubExamRepository()
    return TestClient(app)


def test_public_access_code_is_rate_limited_after_repeated_failures():
    generated_exams_routes.exam_access_limiter.reset("testclient")
    client = _build_client()
    settings = get_settings()

    for _ in range(settings.exam_access_rate_limit):
        resposta = client.post("/conecta-provas-api/acesso/codigo", json={"codigo": "AB12"})
        assert resposta.status_code == 200
        assert resposta.json()["success"] is False

    bloqueada = client.post("/conecta-provas-api/acesso/codigo", json={"codigo": "AB12"})
    assert bloqueada.status_code == 429

    generated_exams_routes.exam_access_limiter.reset("testclient")


def test_public_access_code_reset_after_success():
    generated_exams_routes.exam_access_limiter.reset("testclient")

    class _StubHitOnLastAttempt(_StubExamRepository):
        def __init__(self) -> None:
            self.calls = 0

        def public_access_by_code(self, code: str) -> dict:
            self.calls += 1
            if self.calls == 1:
                return {"success": True, "message": "", "provas": [{"token": "abc"}]}
            return super().public_access_by_code(code)

    app = FastAPI()
    app.include_router(generated_exams_routes.public_router)
    stub = _StubHitOnLastAttempt()
    app.dependency_overrides[get_repository] = lambda: stub
    client = TestClient(app)
    settings = get_settings()

    sucesso = client.post("/conecta-provas-api/acesso/codigo", json={"codigo": "AB12"})
    assert sucesso.status_code == 200
    assert sucesso.json()["success"] is True

    # Depois de um acesso bem-sucedido, o contador reseta: o limite inteiro
    # volta a estar disponível em vez de já contar o sucesso anterior.
    for _ in range(settings.exam_access_rate_limit):
        resposta = client.post("/conecta-provas-api/acesso/codigo", json={"codigo": "ZZ99"})
        assert resposta.status_code == 200

    generated_exams_routes.exam_access_limiter.reset("testclient")
