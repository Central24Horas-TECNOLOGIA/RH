from __future__ import annotations

import logging

from fastapi import APIRouter, Depends

from ..auth import authenticate_credentials
from ..dependencies import get_current_user
from ..schemas.auth import LoginRequest, LoginResponse, SessionResponse
from ..schemas.common import SuccessResponse


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest) -> LoginResponse:
    token = authenticate_credentials(payload.usuario, payload.senha)
    return LoginResponse(access_token=token, usuario=payload.usuario)


@router.get("/me", response_model=SessionResponse)
def me(user=Depends(get_current_user)) -> SessionResponse:
    return SessionResponse(usuario=user.username)


@router.post("/logout", response_model=SuccessResponse)
def logout(user=Depends(get_current_user)) -> SuccessResponse:
    logger.info("Logout solicitado para o usuario '%s'.", user.username)
    return SuccessResponse(message="Sessao encerrada.")
