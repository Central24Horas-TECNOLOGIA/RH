from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Request

from ..auth import AuthenticatedUser, authenticate_session
from ..dependencies import get_current_user, get_repository
from ..repositories import DatabaseRepository
from ..schemas.auth import LoginRequest, LoginResponse, SessionResponse
from ..schemas.common import SuccessResponse


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(
    payload: LoginRequest,
    request: Request = None,
    repository: DatabaseRepository = Depends(get_repository),
) -> LoginResponse:
    origem = request.client.host if request and request.client else ""
    token, user = authenticate_session(
        payload.usuario,
        payload.senha,
        repository=repository,
        origem=origem,
    )
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
