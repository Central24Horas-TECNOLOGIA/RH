from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.middleware.sessions import SessionMiddleware

from rh_api.auth import AuthenticatedUser, reissue_token
from rh_api.dependencies import get_repository
from rh_api.routers import auth as auth_routes


class _StubRepository:
    def __init__(self) -> None:
        self.audit_calls: list[dict] = []

    def record_audit_log(self, **payload):
        self.audit_calls.append(payload)
        return {"success": True}


def _build_client() -> TestClient:
    app = FastAPI()
    app.add_middleware(
        SessionMiddleware,
        secret_key="session-secret-for-tests",
        path="/",
        same_site="lax",
        https_only=False,
        domain=None,
    )
    app.include_router(auth_routes.router)
    app.dependency_overrides[get_repository] = lambda: _StubRepository()
    return TestClient(app, follow_redirects=False)


def test_logout_revokes_the_bearer_token_used_to_call_it():
    client = _build_client()
    token = reissue_token(AuthenticatedUser(username="rh.teste", id_usuario=1))
    headers = {"Authorization": f"Bearer {token}"}

    logout_response = client.post("/auth/logout", headers=headers)
    assert logout_response.status_code == 200

    session_response = client.get("/auth/me", headers=headers)
    assert session_response.status_code == 401
