from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from ..config import get_settings
from ..dependencies import get_current_user, get_repository, require_permissions
from ..repositories import DatabaseRepository


router = APIRouter(tags=["system"])


@router.get("/")
def root():
    settings = get_settings()
    return {
        "status": "ok",
        "message": "API RH Provas online",
        "server": settings.sql_server,
        "database": settings.sql_database,
        "environment": settings.app_env,
    }


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
            detail="Endpoint disponivel apenas em ambiente de desenvolvimento.",
        )

    return repository.get_history_columns()
