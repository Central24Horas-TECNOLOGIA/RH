from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, Query, Request

from ..config import get_settings
from ..dependencies import get_current_user, get_repository
from ..repositories import DatabaseRepository
from ..schemas.history import AnswerFileRequest, HistoryRecordRequest


router = APIRouter(tags=["history"], dependencies=[Depends(get_current_user)])
logger = logging.getLogger(__name__)


def _build_safe_payload_preview(payload: dict | None) -> dict:
    safe_payload = payload if isinstance(payload, dict) else {}
    result = {}

    for key, value in safe_payload.items():
        if isinstance(value, dict):
            result[key] = "<object>"
            continue

        if isinstance(value, list):
            result[key] = f"<list:{len(value)}>"
            continue

        text = str(value if value is not None else "").strip()
        if len(text) > 180:
            text = f"{text[:180]}..."
        result[key] = text

    return result


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
async def save_history(
    request: Request,
    payload: HistoryRecordRequest,
    repository: DatabaseRepository = Depends(get_repository),
):
    raw_payload = {}
    try:
        raw_payload = await request.json()
    except Exception:
        raw_payload = {}

    if get_settings().is_development:
        logger.info(
            "Payload recebido em /history. raw=%s parsed=%s",
            json.dumps(_build_safe_payload_preview(raw_payload), ensure_ascii=False),
            json.dumps(_build_safe_payload_preview(payload.model_dump()), ensure_ascii=False),
        )

    return repository.save_history(payload.model_dump(), raw_payload=raw_payload)


@router.get("/answer-files")
def get_answer_files(repository: DatabaseRepository = Depends(get_repository)):
    return repository.get_answer_files()


@router.post("/answer-files")
def save_answer_file(
    payload: AnswerFileRequest,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.save_answer_file(payload.model_dump())
