from __future__ import annotations

from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import Response

from ..auth import AuthenticatedUser
from ..config import get_settings
from ..dependencies import audit_action, get_current_user, get_repository, require_permissions
from ..repositories import DatabaseRepository
from ..schemas.onedrive import OneDriveFolderCreateRequest
from ..services.onedrive_service import OneDriveService

router = APIRouter(prefix="/onedrive", tags=["onedrive"], dependencies=[Depends(get_current_user)])


def get_onedrive_service() -> OneDriveService:
    return OneDriveService(get_settings())


@router.get("/items", dependencies=[Depends(require_permissions("onedrive.visualizar"))])
def list_items(
    caminho: str = Query(default=""),
    service: OneDriveService = Depends(get_onedrive_service),
):
    return service.list_items(caminho)


@router.post("/folders", dependencies=[Depends(require_permissions("onedrive.upload"))])
def create_folder(
    payload: OneDriveFolderCreateRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    repository: DatabaseRepository = Depends(get_repository),
    service: OneDriveService = Depends(get_onedrive_service),
):
    result = service.create_folder(payload.caminho, payload.nome_pasta)
    audit_action(
        repository,
        user,
        modulo="OneDrive",
        acao="criar_pasta",
        entidade="onedrive_item",
        entidade_id=f"{payload.caminho}/{payload.nome_pasta}".strip("/"),
    )
    return result


@router.post("/upload", dependencies=[Depends(require_permissions("onedrive.upload"))])
async def upload_file(
    caminho: str = Query(default=""),
    arquivo: UploadFile = File(...),
    user: AuthenticatedUser = Depends(get_current_user),
    repository: DatabaseRepository = Depends(get_repository),
    service: OneDriveService = Depends(get_onedrive_service),
):
    content = await arquivo.read()
    result = service.upload_file(caminho, arquivo.filename or "arquivo", content, arquivo.content_type or "")
    audit_action(
        repository,
        user,
        modulo="OneDrive",
        acao="upload_arquivo",
        entidade="onedrive_item",
        entidade_id=f"{caminho}/{arquivo.filename}".strip("/"),
        valor_novo={"tamanho_bytes": len(content)},
    )
    return result


@router.get("/download", dependencies=[Depends(require_permissions("onedrive.visualizar"))])
def download_file(
    caminho: str = Query(...),
    user: AuthenticatedUser = Depends(get_current_user),
    repository: DatabaseRepository = Depends(get_repository),
    service: OneDriveService = Depends(get_onedrive_service),
):
    content, filename, mime_type = service.download_file(caminho)
    audit_action(
        repository,
        user,
        modulo="OneDrive",
        acao="download_arquivo",
        entidade="onedrive_item",
        entidade_id=caminho,
    )
    return Response(
        content=content,
        media_type=mime_type,
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"},
    )


@router.delete("/items", dependencies=[Depends(require_permissions("onedrive.excluir"))])
def delete_item(
    caminho: str = Query(...),
    justificativa: str = Query(default=""),
    user: AuthenticatedUser = Depends(get_current_user),
    repository: DatabaseRepository = Depends(get_repository),
    service: OneDriveService = Depends(get_onedrive_service),
):
    result = service.delete_item(caminho)
    audit_action(
        repository,
        user,
        modulo="OneDrive",
        acao="excluir_item",
        entidade="onedrive_item",
        entidade_id=caminho,
        justificativa=justificativa,
    )
    return result
