from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from ..dependencies import get_current_user, get_repository
from ..repositories.db_repository import DatabaseRepository
from ..schemas.pipeline import PipelineCardCreateRequest, PipelineCardMoveRequest


router = APIRouter(tags=["pipeline"], dependencies=[Depends(get_current_user)])


@router.get("/candidate-pipeline")
def get_candidate_pipeline(
    id_processo: str = Query(default=""),
    search: str = Query(default=""),
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.list_pipeline_cards(id_processo=id_processo, search=search)


@router.post("/candidate-pipeline")
def create_candidate_pipeline_card(
    payload: PipelineCardCreateRequest,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.create_pipeline_candidate(payload.model_dump())


@router.put("/candidate-pipeline/{id_registro}/stage")
def move_candidate_pipeline_card(
    id_registro: int,
    payload: PipelineCardMoveRequest,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.move_pipeline_card(id_registro, payload.model_dump())
