from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, UploadFile

from ..dependencies import get_current_user, get_repository
from ..repositories.db_repository import DatabaseRepository
from ..schemas.processes import (
    CvPreAnalysisUpdateRequest,
    ProcessCandidateCreateRequest,
    ProcessCandidateStatusUpdateRequest,
    ProcessCreateRequest,
    ProcessUpdateRequest,
    TalentBankUseRequest,
)


router = APIRouter(tags=["processes"], dependencies=[Depends(get_current_user)])


@router.get("/processes")
def get_processes(repository: DatabaseRepository = Depends(get_repository)):
    return repository.list_processes()


@router.post("/processes")
def create_process(
    payload: ProcessCreateRequest,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.create_process(payload.model_dump())


@router.put("/processes/{id_processo}")
def update_process(
    id_processo: str,
    payload: ProcessUpdateRequest,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.update_process(id_processo, payload.model_dump())


@router.post("/processes/{id_processo}/close")
def close_process(
    id_processo: str,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.close_process(id_processo)


@router.get("/process-candidates")
def get_process_candidates(repository: DatabaseRepository = Depends(get_repository)):
    return repository.list_process_candidates()


@router.post("/process-candidates")
def create_process_candidate(
    payload: ProcessCandidateCreateRequest,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.create_process_candidate(payload.model_dump())


@router.put("/process-candidates/{id_registro}/status")
def update_process_candidate_status(
    id_registro: int,
    payload: ProcessCandidateStatusUpdateRequest,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.update_process_candidate_status(id_registro, payload.model_dump())


@router.get("/talent-bank")
def get_talent_bank(repository: DatabaseRepository = Depends(get_repository)):
    return repository.list_talent_bank()


@router.delete("/talent-bank/{id_banco}")
def delete_talent_bank_candidate(
    id_banco: int,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.delete_talent_bank_candidate(id_banco)


@router.post("/talent-bank/{id_banco}/use")
def use_talent_bank_candidate(
    id_banco: int,
    payload: TalentBankUseRequest,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.use_talent_bank_candidate(id_banco, payload.model_dump())


@router.get("/processes/{id_processo}/details")
def get_process_details(
    id_processo: str,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.get_process_details(id_processo)


@router.get("/processes/{id_processo}/cv-pre-analyses")
def list_cv_pre_analyses(
    id_processo: str,
    page: int = 1,
    page_size: int = 5,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.list_cv_pre_analyses(id_processo, page, page_size)


@router.post("/processes/{id_processo}/cv-pre-analyses")
async def create_cv_pre_analysis(
    id_processo: str,
    arquivo: UploadFile = File(...),
    guardar_cv_original: str = Form("0"),
    repository: DatabaseRepository = Depends(get_repository),
):
    return await repository.create_cv_pre_analysis(id_processo, arquivo, guardar_cv_original)


@router.put("/cv-pre-analyses/{id_pre_analise}")
def update_cv_pre_analysis(
    id_pre_analise: int,
    payload: CvPreAnalysisUpdateRequest,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.update_cv_pre_analysis(id_pre_analise, payload.model_dump())


@router.delete("/cv-pre-analyses/{id_pre_analise}")
def delete_cv_pre_analysis(
    id_pre_analise: int,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.delete_cv_pre_analysis(id_pre_analise)


@router.post("/cv-pre-analyses/{id_pre_analise}/add-to-process")
def add_cv_pre_analysis_to_process(
    id_pre_analise: int,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.add_cv_pre_analysis_to_process(id_pre_analise)
