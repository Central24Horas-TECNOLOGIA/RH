from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from ..dependencies import get_current_user, get_repository
from ..repositories import DatabaseRepository
from ..schemas.interviews import (
    InterviewCreateRequest,
    InterviewSlotCreateRequest,
    InterviewSlotUpdateRequest,
    InterviewUpdateRequest,
)


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


@router.get("/interview-slots")
def get_interview_slots(
    id_processo: str = Query(default=""),
    date: str = Query(default=""),
    status_slot: str = Query(default=""),
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.list_interview_slots(
        id_processo=id_processo,
        date=date,
        status_slot=status_slot,
    )


@router.post("/interview-slots")
def create_interview_slots(
    payload: InterviewSlotCreateRequest,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.create_interview_slots(payload.model_dump())


@router.put("/interview-slots/{id_slot}")
def update_interview_slot(
    id_slot: int,
    payload: InterviewSlotUpdateRequest,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.update_interview_slot(id_slot, payload.model_dump(exclude_none=True))


@router.delete("/interview-slots/{id_slot}")
def delete_interview_slot(
    id_slot: int,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.delete_interview_slot(id_slot)


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
