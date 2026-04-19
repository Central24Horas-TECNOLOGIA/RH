from __future__ import annotations

from fastapi import APIRouter, Depends

from ..config import get_settings
from ..dependencies import get_current_user, get_repository
from ..repositories.db_repository import DatabaseRepository


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


@router.get("/debug/gabaritos-columns")
def debug_gabaritos_columns(
    repository: DatabaseRepository = Depends(get_repository),
    _user=Depends(get_current_user),
):
    return repository.get_gabaritos_columns()
