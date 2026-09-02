from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from ..auth import AuthenticatedUser
from ..dependencies import audit_action, get_current_user, get_repository, require_permissions
from ..repositories import DatabaseRepository
from ..schemas.calendar import CelebratoryDateCreateRequest, CelebratoryDateUpdateRequest


router = APIRouter(prefix="/celebratory-dates", tags=["calendar"], dependencies=[Depends(get_current_user)])
events_router = APIRouter(prefix="/calendar", tags=["calendar"], dependencies=[Depends(get_current_user)])


@router.get("")
def list_celebratory_dates(repository: DatabaseRepository = Depends(get_repository)):
    return repository.list_celebratory_dates()


@events_router.get("/events")
def list_calendar_events(
    user: AuthenticatedUser = Depends(get_current_user),
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.list_calendar_events(include_interviews=user.has_permission("entrevistas.visualizar"))


@router.post("", dependencies=[Depends(require_permissions("calendario.editar"))])
def create_celebratory_date(
    payload: CelebratoryDateCreateRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    repository: DatabaseRepository = Depends(get_repository),
):
    result = repository.create_celebratory_date(payload.model_dump(), actor=user.username)
    audit_action(
        repository,
        user,
        modulo="Calendário",
        acao="criar_data_comemorativa",
        entidade="data_comemorativa",
        entidade_id=str(result.get("id_data") or ""),
        valor_novo=payload.model_dump(),
    )
    return result


@router.put("/{id_data}", dependencies=[Depends(require_permissions("calendario.editar"))])
def update_celebratory_date(
    id_data: int,
    payload: CelebratoryDateUpdateRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    repository: DatabaseRepository = Depends(get_repository),
):
    result = repository.update_celebratory_date(id_data, payload.model_dump(), actor=user.username)
    audit_action(
        repository,
        user,
        modulo="Calendário",
        acao="editar_data_comemorativa",
        entidade="data_comemorativa",
        entidade_id=str(id_data),
        valor_novo=payload.model_dump(),
    )
    return result


@router.delete("/{id_data}", dependencies=[Depends(require_permissions("calendario.editar"))])
def delete_celebratory_date(
    id_data: int,
    justificativa: str = Query(default=""),
    user: AuthenticatedUser = Depends(get_current_user),
    repository: DatabaseRepository = Depends(get_repository),
):
    result = repository.delete_celebratory_date(id_data, actor=user.username)
    audit_action(
        repository,
        user,
        modulo="Calendário",
        acao="excluir_data_comemorativa",
        entidade="data_comemorativa",
        entidade_id=str(id_data),
        justificativa=justificativa,
    )
    return result
