from __future__ import annotations

from fastapi import APIRouter, Depends

from ..dependencies import get_current_user, get_repository, require_permissions
from ..repositories import DatabaseRepository


router = APIRouter(tags=["operations"], dependencies=[Depends(get_current_user)])


@router.get("/operacoes", dependencies=[Depends(require_permissions("operacoes.visualizar"))])
def list_operacoes(repository: DatabaseRepository = Depends(get_repository)):
    """Lista enxuta de operações ativas, para preencher o <select> de operação
    em telas operacionais (criar processo, gerar prova). O CRUD completo
    (criar/editar/desativar) continua em /settings/catalog/operacoes, restrito
    a quem tem configuracoes.editar."""
    return repository.list_catalog_items_by_type("operacoes", apenas_ativos=True)
