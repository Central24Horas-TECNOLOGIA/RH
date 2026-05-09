from __future__ import annotations

from fastapi import APIRouter, Body, Depends, File, Form, Query, Request, UploadFile
from fastapi.responses import FileResponse

from ..dependencies import get_current_user, get_repository
from ..repositories import DatabaseRepository
from ..schemas.processes import (
    CandidateProfileUpdateRequest,
    CvPreAnalysisUpdateRequest,
    ProcessCandidateCreateRequest,
    ProcessCandidateStatusUpdateRequest,
    ProcessCreateRequest,
    ProcessUpdateRequest,
    StandaloneCandidateStatusUpdateRequest,
    TalentBankCreateRequest,
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
def get_talent_bank(
    search: str = Query(default=""),
    skill: str = Query(default=""),
    tag: str = Query(default=""),
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.list_talent_bank(search=search, skill=skill, tag=tag)


@router.post("/talent-bank")
def create_talent_bank_candidate(
    payload: TalentBankCreateRequest,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.add_candidate_to_talent_bank(payload.model_dump())


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


@router.put("/candidate-profiles/{id_teste}")
def update_candidate_profile(
    id_teste: str,
    payload: CandidateProfileUpdateRequest,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.upsert_candidate_profile(id_teste, payload.model_dump())


@router.put("/candidate-profiles/{id_teste}/status")
def update_standalone_candidate_status(
    id_teste: str,
    payload: StandaloneCandidateStatusUpdateRequest,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.update_standalone_candidate_status(id_teste, payload.model_dump())


@router.get("/processes/{id_processo}/details")
def get_process_details(
    id_processo: str,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.get_process_details(id_processo)


@router.post("/processos/{id_processo}/gerar-link-candidatura")
def generate_public_application_link(
    id_processo: str,
    request: Request,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.generate_public_application_link(
        id_processo,
        referrer_url=request.headers.get("referer", ""),
        origin_url=request.headers.get("origin", ""),
    )


@router.patch("/processos/{id_processo}/link-candidatura/desativar")
def deactivate_public_application_link(
    id_processo: str,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.deactivate_public_application_link(id_processo)


@router.get("/candidate-profiles/{id_teste}/cv")
def download_candidate_cv(
    id_teste: str,
    repository: DatabaseRepository = Depends(get_repository),
):
    asset = repository.get_candidate_cv_asset(id_teste)
    return FileResponse(
        asset["path"],
        media_type=asset["media_type"],
        filename=asset["filename"],
    )


@router.post("/candidate-profiles/{id_teste}/analyze-cv")
def analyze_candidate_profile_cv(
    id_teste: str,
    payload: dict | None = Body(default=None),
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.analyze_candidate_profile_cv(
        id_teste,
        id_processo=(payload or {}).get("id_processo", ""),
    )


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
    payload: dict | None = Body(default=None),
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.add_cv_pre_analysis_to_process(
        id_pre_analise,
        manual_override=bool((payload or {}).get("manual_override")),
        motivo_override=(payload or {}).get("motivo_override", ""),
    )


@router.post("/cv-pre-analyses/{id_pre_analise}/talent-bank")
def add_cv_pre_analysis_to_talent_bank(
    id_pre_analise: int,
    repository: DatabaseRepository = Depends(get_repository),
):
    return repository.add_cv_pre_analysis_to_talent_bank(id_pre_analise)
