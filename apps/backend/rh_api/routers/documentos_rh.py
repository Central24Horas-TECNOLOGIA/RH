from __future__ import annotations

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import FileResponse

from ..auth import AuthenticatedUser
from ..dependencies import audit_action, get_current_user, get_repository, require_permissions
from ..repositories import DatabaseRepository
from ..schemas.documentos_rh import (
    CriarPastaDocumentoRhRequest,
    RenomearDocumentoRhRequest,
)


router = APIRouter(tags=["documentos-rh"], dependencies=[Depends(get_current_user)])


@router.get(
    "/documentos-rh",
    dependencies=[Depends(require_permissions("documentos_rh.visualizar"))],
)
def listar_documentos_rh(
    id_pasta_pai: int | None = Query(default=None),
    tipo: str = Query(default=""),
    categoria_extensao: str = Query(default=""),
    busca: str = Query(default=""),
    criado_por: str = Query(default=""),
    data_criacao_de: str = Query(default=""),
    data_criacao_ate: str = Query(default=""),
    data_modificacao_de: str = Query(default=""),
    data_modificacao_ate: str = Query(default=""),
    repository: DatabaseRepository = Depends(get_repository),
):
    itens = repository.list_documentos_rh(
        id_pasta_pai=id_pasta_pai,
        tipo=tipo,
        categoria_extensao=categoria_extensao,
        busca=busca,
        criado_por=criado_por,
        data_criacao_de=data_criacao_de,
        data_criacao_ate=data_criacao_ate,
        data_modificacao_de=data_modificacao_de,
        data_modificacao_ate=data_modificacao_ate,
    )
    trilha = repository.get_documento_rh_breadcrumb(id_pasta_pai)
    return {"itens": itens, "trilha": trilha}


@router.post(
    "/documentos-rh/pastas",
    dependencies=[Depends(require_permissions("documentos_rh.gerenciar"))],
)
def criar_pasta_documento_rh(
    payload: CriarPastaDocumentoRhRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    repository: DatabaseRepository = Depends(get_repository),
):
    resultado = repository.criar_pasta_documento_rh(
        nome=payload.nome,
        id_pasta_pai=payload.id_pasta_pai,
        criado_por=user.nome or user.username,
    )
    audit_action(
        repository,
        user,
        modulo="Drive-Conecta",
        acao="criar_pasta",
        entidade="documento_rh",
        entidade_id=str(resultado.get("id", "")),
        valor_novo={"nome": payload.nome, "id_pasta_pai": payload.id_pasta_pai},
    )
    return resultado


@router.post(
    "/documentos-rh/upload",
    dependencies=[Depends(require_permissions("documentos_rh.gerenciar"))],
)
async def upload_documento_rh(
    arquivo: UploadFile = File(...),
    id_pasta_pai: int | None = Query(default=None),
    user: AuthenticatedUser = Depends(get_current_user),
    repository: DatabaseRepository = Depends(get_repository),
):
    resultado = await repository.upload_arquivo_documento_rh(
        arquivo=arquivo,
        id_pasta_pai=id_pasta_pai,
        criado_por=user.nome or user.username,
    )
    audit_action(
        repository,
        user,
        modulo="Drive-Conecta",
        acao="upload_arquivo",
        entidade="documento_rh",
        entidade_id=str(resultado.get("id", "")),
        valor_novo={"nome": arquivo.filename or "", "id_pasta_pai": id_pasta_pai},
    )
    return resultado


@router.get(
    "/documentos-rh/{id_documento}/conteudo",
    dependencies=[Depends(require_permissions("documentos_rh.visualizar"))],
)
def obter_conteudo_documento_rh(
    id_documento: int,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.obter_conteudo_documento_rh(id_documento)


@router.get(
    "/documentos-rh/{id_documento}/download",
    dependencies=[Depends(require_permissions("documentos_rh.visualizar"))],
)
def baixar_documento_rh(
    id_documento: int,
    repository: DatabaseRepository = Depends(get_repository),
):
    arquivo = repository.baixar_documento_rh(id_documento)
    return FileResponse(
        arquivo["path"],
        media_type=arquivo["media_type"],
        filename=arquivo["filename"],
    )


@router.patch(
    "/documentos-rh/{id_documento}",
    dependencies=[Depends(require_permissions("documentos_rh.gerenciar"))],
)
def renomear_documento_rh(
    id_documento: int,
    payload: RenomearDocumentoRhRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    repository: DatabaseRepository = Depends(get_repository),
):
    resultado = repository.renomear_documento_rh(id_documento, payload.nome)
    audit_action(
        repository,
        user,
        modulo="Drive-Conecta",
        acao="renomear_item",
        entidade="documento_rh",
        entidade_id=str(id_documento),
        valor_novo={"nome": payload.nome},
    )
    return resultado


@router.delete(
    "/documentos-rh/{id_documento}",
    dependencies=[Depends(require_permissions("documentos_rh.gerenciar"))],
)
def excluir_documento_rh(
    id_documento: int,
    user: AuthenticatedUser = Depends(get_current_user),
    repository: DatabaseRepository = Depends(get_repository),
):
    resultado = repository.excluir_documento_rh(id_documento)
    audit_action(
        repository,
        user,
        modulo="Drive-Conecta",
        acao="excluir_item",
        entidade="documento_rh",
        entidade_id=str(id_documento),
    )
    return resultado
