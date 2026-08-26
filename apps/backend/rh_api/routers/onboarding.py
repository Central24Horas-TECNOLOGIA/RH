from __future__ import annotations

from fastapi import APIRouter, Depends

from ..auth import AuthenticatedUser
from ..dependencies import audit_action, get_current_user, get_repository, require_permissions
from ..repositories import DatabaseRepository
from ..schemas.onboarding import (
    OnboardingAssignmentUpdateRequest,
    OnboardingItemToggleRequest,
    OnboardingStartRequest,
    OnboardingTrilhaCreateRequest,
    OnboardingTrilhaUpdateRequest,
)


router = APIRouter(prefix="/onboarding", tags=["onboarding"], dependencies=[Depends(get_current_user)])


@router.get("/trilhas", dependencies=[Depends(require_permissions("onboarding.visualizar", "onboarding.editar"))])
def list_onboarding_trilhas(
    categoria: str = "",
    id_operacao: int = 0,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.list_onboarding_trilhas(categoria=categoria or None, id_operacao=id_operacao or None)


@router.get("/assignments", dependencies=[Depends(require_permissions("onboarding.visualizar", "onboarding.editar"))])
def list_onboarding_assignments(status: str = "", repository: DatabaseRepository = Depends(get_repository)):
    return repository.list_onboarding_assignments(status_filtro=status or None)


@router.put("/assignments/{id_onboarding}", dependencies=[Depends(require_permissions("onboarding.editar"))])
def update_onboarding_assignment(
    id_onboarding: int,
    payload: OnboardingAssignmentUpdateRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    repository: DatabaseRepository = Depends(get_repository),
):
    result = repository.update_onboarding_assignment(id_onboarding, payload.model_dump(), actor=user.username)
    audit_action(
        repository,
        user,
        modulo="Onboarding",
        acao="atualizar_agenda_treinamento",
        entidade="onboarding_candidato",
        entidade_id=str(id_onboarding),
        valor_novo=payload.model_dump(),
    )
    return result


@router.get("/trilhas/{id_trilha}", dependencies=[Depends(require_permissions("onboarding.visualizar", "onboarding.editar"))])
def get_onboarding_trilha(id_trilha: int, repository: DatabaseRepository = Depends(get_repository)):
    return repository.get_onboarding_trilha(id_trilha)


@router.post("/trilhas", dependencies=[Depends(require_permissions("onboarding.editar"))])
def create_onboarding_trilha(
    payload: OnboardingTrilhaCreateRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    repository: DatabaseRepository = Depends(get_repository),
):
    result = repository.create_onboarding_trilha(payload.model_dump(), actor=user.username)
    audit_action(
        repository,
        user,
        modulo="Onboarding",
        acao="criar_trilha_onboarding",
        entidade="trilha_onboarding",
        entidade_id=str(result.get("id_trilha") or ""),
        valor_novo=payload.model_dump(),
    )
    return result


@router.put("/trilhas/{id_trilha}", dependencies=[Depends(require_permissions("onboarding.editar"))])
def update_onboarding_trilha(
    id_trilha: int,
    payload: OnboardingTrilhaUpdateRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    repository: DatabaseRepository = Depends(get_repository),
):
    result = repository.update_onboarding_trilha(id_trilha, payload.model_dump(), actor=user.username)
    audit_action(
        repository,
        user,
        modulo="Onboarding",
        acao="editar_trilha_onboarding",
        entidade="trilha_onboarding",
        entidade_id=str(id_trilha),
        valor_novo=payload.model_dump(),
    )
    return result


@router.post("/candidatos/iniciar", dependencies=[Depends(require_permissions("onboarding.editar"))])
def start_onboarding(
    payload: OnboardingStartRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    repository: DatabaseRepository = Depends(get_repository),
):
    result = repository.start_onboarding(
        payload.id_registro,
        payload.trilha_id,
        actor=user.username,
        data_prevista=payload.data_prevista,
        local=payload.local,
        ministrante=payload.ministrante,
    )
    audit_action(
        repository,
        user,
        modulo="Onboarding",
        acao="iniciar_onboarding_candidato",
        entidade="onboarding_candidato",
        entidade_id=str(payload.id_registro),
        valor_novo=payload.model_dump(),
    )
    return result


@router.get(
    "/candidatos/{id_registro}",
    dependencies=[Depends(require_permissions("onboarding.visualizar", "onboarding.editar"))],
)
def get_onboarding_progress(id_registro: int, repository: DatabaseRepository = Depends(get_repository)):
    return repository.get_onboarding_progress(id_registro)


@router.put("/itens/{id_onboarding_item}", dependencies=[Depends(require_permissions("onboarding.editar"))])
def set_onboarding_item_status(
    id_onboarding_item: int,
    payload: OnboardingItemToggleRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    repository: DatabaseRepository = Depends(get_repository),
):
    result = repository.set_onboarding_item_status(id_onboarding_item, payload.concluido, actor=user.username)
    audit_action(
        repository,
        user,
        modulo="Onboarding",
        acao="marcar_item_onboarding" if payload.concluido else "desmarcar_item_onboarding",
        entidade="onboarding_item",
        entidade_id=str(id_onboarding_item),
        valor_novo=payload.model_dump(),
    )
    return result
