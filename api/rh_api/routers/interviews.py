from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from ..dependencies import get_current_user, get_repository
from ..repositories.db_repository import DatabaseRepository
from ..schemas.interviews import InterviewCreateRequest, InterviewUpdateRequest


router = APIRouter(tags=["interviews"], dependencies=[Depends(get_current_user)])


@router.get("/interviews")
def get_interviews(
    id_processo: str = Query(default=""),
    status_entrevista: str = Query(default=""),
    search: str = Query(default=""),
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.list_interviews(
        id_processo=id_processo,
        status_entrevista=status_entrevista,
        search=search,
    )


@router.post("/interviews")
def create_interview(
    payload: InterviewCreateRequest,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.create_interview(payload.model_dump())


@router.put("/interviews/{id_entrevista}")
def update_interview(
    id_entrevista: int,
    payload: InterviewUpdateRequest,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.update_interview(id_entrevista, payload.model_dump(exclude_none=True))
