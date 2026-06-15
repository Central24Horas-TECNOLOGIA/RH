from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from ..config import Settings, get_settings
from ..dependencies import get_current_user, get_repository, require_permissions
from ..repositories import DatabaseRepository


router = APIRouter(tags=["system"])


def build_system_status(settings: Settings | None = None) -> dict:
    active_settings = settings or get_settings()
    return {
        "status": "ok",
        "message": "API RH Provas online",
        "server": active_settings.sql_server,
        "database": active_settings.sql_database,
        "environment": active_settings.app_env,
    }


@router.get("/api/status")
def api_status():
    return build_system_status()


@router.get("/health")
def health():
    return build_system_status()


@router.get("/debug/gabaritos-columns", dependencies=[Depends(require_permissions("logs.visualizar"))])
def debug_gabaritos_columns(
    repository: DatabaseRepository = Depends(get_repository),
    _user=Depends(get_current_user),
):
    return repository.get_gabaritos_columns()


@router.get("/debug/historico-provas-columns", dependencies=[Depends(require_permissions("logs.visualizar"))])
def debug_historico_provas_columns(
    repository: DatabaseRepository = Depends(get_repository),
    _user=Depends(get_current_user),
):
    settings = get_settings()
    if not settings.is_development:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Endpoint disponível apenas em ambiente de desenvolvimento.",
        )

    return repository.get_history_columns()
