from __future__ import annotations

from fastapi import APIRouter, Body, Depends, Query
from fastapi.responses import FileResponse

from ..dependencies import get_current_user, get_repository
from ..repositories import DatabaseRepository


router = APIRouter(tags=["email-inbox"], dependencies=[Depends(get_current_user)])


@router.get("/email-inbox/status")
def get_email_inbox_status(repository: DatabaseRepository = Depends(get_repository)):
    return repository.get_configured_email_inbox_status()


@router.get("/email-inbox/messages")
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


@router.get("/email-inbox/messages/{item_id}")
def get_email_inbox_message(
    item_id: str,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.get_configured_email_inbox_item(item_id)


@router.post("/email-inbox/messages/{item_id}/download-attachments")
def download_email_inbox_attachments(
    item_id: str,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.download_configured_email_inbox_attachments(item_id)


@router.post("/email-inbox/messages/{item_id}/analyze-cv")
def analyze_email_inbox_cv(
    item_id: str,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.analyze_configured_email_inbox_cv(item_id)


@router.post("/email-inbox/messages/{item_id}/link-process")
def link_email_inbox_to_process(
    item_id: str,
    payload: dict | None = Body(default=None),
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.link_configured_email_inbox_to_process(item_id, payload or {})


@router.post("/email-inbox/messages/{item_id}/talent-bank")
def send_email_inbox_to_talent_bank(
    item_id: str,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.send_configured_email_inbox_to_talent_bank(item_id)


@router.post("/email-inbox/messages/{item_id}/ignore")
def ignore_email_inbox_item(
    item_id: str,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.ignore_configured_email_inbox_item(item_id)

@router.delete("/email-inbox/messages/{item_id}")
def delete_email_inbox_item(
    item_id: str,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.delete_configured_email_inbox_item(item_id)

@router.get("/email-inbox/messages/{item_id}/attachment")
def get_primary_email_inbox_attachment(
    item_id: str,
    repository: DatabaseRepository = Depends(get_repository),
):
    attachment = repository.get_configured_email_inbox_attachment(item_id)
    return FileResponse(
        attachment["path"],
        media_type=attachment.get("content_type") or "application/octet-stream",
        filename=attachment.get("filename") or "curriculo",
    )


@router.get("/email-inbox/messages/{item_id}/attachment/{attachment_id}")
def get_email_inbox_attachment(
    item_id: str,
    attachment_id: str,
    repository: DatabaseRepository = Depends(get_repository),
):
    attachment = repository.get_configured_email_inbox_attachment(item_id, attachment_id)
    return FileResponse(
        attachment["path"],
        media_type=attachment.get("content_type") or "application/octet-stream",
        filename=attachment.get("filename") or "curriculo",
    )
