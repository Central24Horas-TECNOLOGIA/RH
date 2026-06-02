from __future__ import annotations

from fastapi import APIRouter, Body, Depends, Query
from fastapi.responses import FileResponse

from ..auth import AuthenticatedUser
from ..dependencies import audit_action, get_current_user, get_repository, require_permissions
from ..repositories import DatabaseRepository


router = APIRouter(tags=["email-inbox"], dependencies=[Depends(get_current_user)])


@router.get("/email-inbox/status", dependencies=[Depends(require_permissions("candidatos.visualizar"))])
def get_email_inbox_status(repository: DatabaseRepository = Depends(get_repository)):
    return repository.get_configured_email_inbox_status()


@router.get("/email-inbox/messages", dependencies=[Depends(require_permissions("candidatos.visualizar"))])
def list_email_inbox_messages(
    limit: int = Query(default=50),
    unread_only: bool = Query(default=False),
    with_attachments_only: bool = Query(default=True),
    refresh: bool = Query(default=True),
    query: str = Query(default=""),
    include_ignored: bool = Query(default=False),
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.list_configured_email_inbox_messages(
        limit=limit,
        unread_only=unread_only,
        with_attachments_only=with_attachments_only,
        refresh=refresh,
        query=query,
        include_ignored=include_ignored,
    )


@router.get("/email-inbox/messages/{item_id}", dependencies=[Depends(require_permissions("candidatos.visualizar"))])
def get_email_inbox_message(
    item_id: str,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.get_configured_email_inbox_item(item_id)


@router.post("/email-inbox/messages/{item_id}/download-attachments", dependencies=[Depends(require_permissions("candidatos.baixar_curriculo"))])
def download_email_inbox_attachments(
    item_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    repository: DatabaseRepository = Depends(get_repository),
):
    result = repository.download_configured_email_inbox_attachments(item_id)
    audit_action(
        repository,
        user,
        modulo="Candidatos",
        acao="baixar_anexos_email",
        entidade="email_inbox",
        entidade_id=item_id,
    )
    return result


@router.post("/email-inbox/messages/{item_id}/analyze-cv", dependencies=[Depends(require_permissions("candidatos.avaliar_curriculo"))])
def analyze_email_inbox_cv(
    item_id: str,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.analyze_configured_email_inbox_cv(item_id)


@router.post("/email-inbox/messages/{item_id}/link-process", dependencies=[Depends(require_permissions("candidatos.criar"))])
def link_email_inbox_to_process(
    item_id: str,
    payload: dict | None = Body(default=None),
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.link_configured_email_inbox_to_process(item_id, payload or {})


@router.post("/email-inbox/messages/{item_id}/talent-bank", dependencies=[Depends(require_permissions("candidatos.mover_etapa"))])
def send_email_inbox_to_talent_bank(
    item_id: str,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.send_configured_email_inbox_to_talent_bank(item_id)


@router.post("/email-inbox/messages/{item_id}/ignore", dependencies=[Depends(require_permissions("candidatos.mover_etapa"))])
def ignore_email_inbox_item(
    item_id: str,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.ignore_configured_email_inbox_item(item_id)

@router.delete("/email-inbox/messages/{item_id}", dependencies=[Depends(require_permissions("candidatos.excluir"))])
def delete_email_inbox_item(
    item_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    repository: DatabaseRepository = Depends(get_repository),
):
    result = repository.delete_configured_email_inbox_item(item_id)
    audit_action(
        repository,
        user,
        modulo="Candidatos",
        acao="excluir_email_recebido",
        entidade="email_inbox",
        entidade_id=item_id,
    )
    return result

@router.get("/email-inbox/messages/{item_id}/attachment", dependencies=[Depends(require_permissions("candidatos.baixar_curriculo"))])
def get_primary_email_inbox_attachment(
    item_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    repository: DatabaseRepository = Depends(get_repository),
):
    attachment = repository.get_configured_email_inbox_attachment(item_id)
    audit_action(
        repository,
        user,
        modulo="Candidatos",
        acao="baixar_anexo_email",
        entidade="email_inbox",
        entidade_id=item_id,
    )
    return FileResponse(
        attachment["path"],
        media_type=attachment.get("content_type") or "application/octet-stream",
        filename=attachment.get("filename") or "curriculo",
    )


@router.get("/email-inbox/messages/{item_id}/attachment/{attachment_id}", dependencies=[Depends(require_permissions("candidatos.baixar_curriculo"))])
def get_email_inbox_attachment(
    item_id: str,
    attachment_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    repository: DatabaseRepository = Depends(get_repository),
):
    attachment = repository.get_configured_email_inbox_attachment(item_id, attachment_id)
    audit_action(
        repository,
        user,
        modulo="Candidatos",
        acao="baixar_anexo_email",
        entidade="email_inbox",
        entidade_id=f"{item_id}/{attachment_id}",
    )
    return FileResponse(
        attachment["path"],
        media_type=attachment.get("content_type") or "application/octet-stream",
        filename=attachment.get("filename") or "curriculo",
    )
