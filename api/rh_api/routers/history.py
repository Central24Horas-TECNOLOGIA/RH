from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from ..dependencies import get_current_user, get_repository
from ..repositories import DatabaseRepository
from ..schemas.history import AnswerFileRequest, HistoryRecordRequest


router = APIRouter(tags=["history"], dependencies=[Depends(get_current_user)])


@router.get("/history")
def get_history(
    page: int | None = Query(default=None, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    nome: str = Query(default=""),
    vaga: str = Query(default=""),
    data: str = Query(default=""),
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.list_history(page=page, page_size=page_size, nome=nome, vaga=vaga, data=data)


@router.post("/history")
def save_history(
    payload: HistoryRecordRequest,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.save_history(payload.model_dump())


@router.get("/answer-files")
def get_answer_files(repository: DatabaseRepository = Depends(get_repository)):
    return repository.get_answer_files()


@router.post("/answer-files")
def save_answer_file(
    payload: AnswerFileRequest,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.save_answer_file(payload.model_dump())
