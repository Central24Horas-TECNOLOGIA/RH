from __future__ import annotations

from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from rh_api.auth import AuthenticatedUser
from rh_api.config import get_settings
from rh_api.dependencies import get_current_user, get_repository
from rh_api.routers import curriculos_ia as curriculos_ia_routes


def _fake_settings(**overrides) -> SimpleNamespace:
    base = {
        "ai_enabled": True,
        "ai_provider": "openai",
        "ai_api_key": "sk-teste",
        "ai_model": "gpt-teste",
        "ai_available": True,
        "ai_max_curriculo_chars": 20000,
        "ai_duplicate_window_seconds": 60,
    }
    base.update(overrides)
    return SimpleNamespace(**base)


class _StubRepository:
    def __init__(self, *, ia_analise_desabilitada: bool):
        self._ia_analise_desabilitada = ia_analise_desabilitada
        self.create_curriculo_ia_analysis_called = False

    def get_curriculo_ia_context(self, id_candidato: str, id_processo: str = "") -> dict:
        return {
            "id_candidato": id_candidato,
            "id_processo": id_processo or "P1",
            "candidato": {"id_teste": id_candidato},
            "processo": {
                "id_processo": id_processo or "P1",
                "vaga": "Analista",
                "ia_analise_desabilitada": self._ia_analise_desabilitada,
            },
            "curriculo": {
                "caminho_arquivo": "/tmp/curriculo.pdf",
                "nome_arquivo_original": "curriculo.pdf",
                "tipo_arquivo": "pdf",
            },
        }

    def create_curriculo_ia_analysis(self, **kwargs) -> int:
        self.create_curriculo_ia_analysis_called = True
        return 1

    def fail_curriculo_ia_analysis(self, *args, **kwargs) -> None:
        pass


def _build_client(repository: _StubRepository, *, settings: SimpleNamespace | None = None) -> TestClient:
    app = FastAPI()
    app.include_router(curriculos_ia_routes.router)
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        username="rh.teste",
        id_usuario=1,
        permissions=frozenset({"candidatos.avaliar_curriculo"}),
    )
    app.dependency_overrides[get_repository] = lambda: repository
    app.dependency_overrides[get_settings] = lambda: settings or _fake_settings()
    return TestClient(app)


def test_analyze_curriculo_with_ai_is_blocked_when_process_opted_out():
    repository = _StubRepository(ia_analise_desabilitada=True)
    client = _build_client(repository)

    response = client.post("/curriculos/CAND-1/analisar-ia", params={"id_processo": "P1"})

    assert response.status_code == 403
    assert "desabilitada para este processo" in response.json()["detail"]
    assert repository.create_curriculo_ia_analysis_called is False


def test_analyze_curriculo_with_ai_proceeds_when_process_did_not_opt_out():
    repository = _StubRepository(ia_analise_desabilitada=False)
    client = _build_client(repository)

    response = client.post("/curriculos/CAND-1/analisar-ia", params={"id_processo": "P1"})

    # Passa do gate de opt-out (não é 403 por causa dele) e chega a criar o
    # registro de análise — o resto do fluxo falha em seguida por não haver
    # um arquivo de currículo real no disco (400, CvTextExtractionError),
    # o que é esperado neste teste: só o gate aditivo está sob teste aqui.
    assert response.status_code == 400
    assert repository.create_curriculo_ia_analysis_called is True
