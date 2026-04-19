from __future__ import annotations

from fastapi import APIRouter, Depends

from ..dependencies import get_current_user, get_repository
from ..repositories import DatabaseRepository


router = APIRouter(tags=["analytics"], dependencies=[Depends(get_current_user)])


@router.get("/candidate-analytics")
def get_candidate_analytics(repository: DatabaseRepository = Depends(get_repository)):
    return repository.get_candidate_analytics()


@router.get("/candidate-analytics/{id_teste}")
def get_candidate_analytics_detail(
    id_teste: str,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.get_candidate_analytics_detail(id_teste)
