from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, UploadFile

from ..dependencies import get_repository
from ..repositories import DatabaseRepository


router = APIRouter(tags=["public-candidacy"])


@router.get("/public/candidatura/{slug}")
def get_public_application(
    slug: str,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.get_public_application(slug)


@router.post("/public/candidatura/{slug}/enviar")
async def submit_public_application(
    slug: str,
    nome_completo: str = Form(...),
    email: str = Form(...),
    telefone: str = Form(...),
    cidade: str = Form(...),
    bairro: str = Form(...),
    lgpd_aceito: str = Form(...),
    curriculo: UploadFile = File(...),
    repository: DatabaseRepository = Depends(get_repository),
):
    return await repository.submit_public_application(
        slug,
        nome_completo=nome_completo,
        email=email,
        telefone=telefone,
        cidade=cidade,
        bairro=bairro,
        lgpd_aceito=lgpd_aceito,
        curriculo=curriculo,
    )
