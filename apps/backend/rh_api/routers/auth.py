from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status

from ..auth import AuthenticatedUser, authenticate_session
from ..dependencies import get_current_user, get_repository
from ..repositories import DatabaseRepository
from ..schemas.auth import (
    LoginRequest,
    LoginResponse,
    MfaCodeRequest,
    MfaSetupResponse,
    SessionResponse,
)
from ..schemas.common import SuccessResponse
from ..config import get_settings
from conecta.infrastructure.security.rate_limit import InMemoryRateLimiter


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])
login_limiter = InMemoryRateLimiter()


@router.post("/login", response_model=LoginResponse)
def login(
    payload: LoginRequest,
    request: Request = None,
    repository: DatabaseRepository = Depends(get_repository),
) -> LoginResponse:
    origem = request.client.host if request and request.client else ""
    settings = get_settings()
    limiter_key = f"{origem}:{payload.usuario.strip().lower()}"
    if request is not None and not login_limiter.allow(
        limiter_key,
        limit=settings.auth_login_rate_limit,
        window_seconds=settings.auth_login_rate_window_seconds,
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitas tentativas de login. Aguarde e tente novamente.",
        )
    token, user = authenticate_session(
        payload.usuario,
        payload.senha,
        repository=repository,
        origem=origem,
        mfa_code=payload.mfa_code,
    )
    login_limiter.reset(limiter_key)
    return LoginResponse(
        access_token=token,
        usuario=user.username,
        nome=user.nome,
        email=user.email,
        perfil=user.perfil,
        perfil_nome=user.perfil_nome,
        nivel=user.nivel,
        permissoes=sorted(user.permissions),
    )


@router.get("/me", response_model=SessionResponse)
def me(user: AuthenticatedUser = Depends(get_current_user)) -> SessionResponse:
    return SessionResponse(
        usuario=user.username,
        nome=user.nome,
        email=user.email,
        perfil=user.perfil,
        perfil_nome=user.perfil_nome,
        nivel=user.nivel,
        permissoes=sorted(user.permissions),
    )


@router.post("/mfa/setup", response_model=MfaSetupResponse)
def setup_mfa(
    user: AuthenticatedUser = Depends(get_current_user),
    repository: DatabaseRepository = Depends(get_repository),
) -> MfaSetupResponse:
    if user.id_usuario is None:
        raise HTTPException(status_code=400, detail="MFA exige um usuário persistido no banco.")
    return MfaSetupResponse(**repository.begin_mfa_enrollment(user.id_usuario, actor=user))


@router.post("/mfa/enable", response_model=SuccessResponse)
def enable_mfa(
    payload: MfaCodeRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    repository: DatabaseRepository = Depends(get_repository),
) -> SuccessResponse:
    if user.id_usuario is None:
        raise HTTPException(status_code=400, detail="MFA exige um usuário persistido no banco.")
    result = repository.enable_mfa(user.id_usuario, payload.code, actor=user)
    return SuccessResponse(message=result.get("message") or "MFA ativado.")


@router.post("/logout", response_model=SuccessResponse)
def logout(
    user: AuthenticatedUser = Depends(get_current_user),
    repository: DatabaseRepository = Depends(get_repository),
) -> SuccessResponse:
    logger.info("Logout solicitado para o usuario '%s'.", user.username)
    if hasattr(repository, "record_audit_log"):
        repository.record_audit_log(
            user=user,
            modulo="Autenticacao",
            acao="logout",
            entidade="sessao",
            entidade_id=user.username,
            sucesso=True,
        )
    return SuccessResponse(message="Sessao encerrada.")
