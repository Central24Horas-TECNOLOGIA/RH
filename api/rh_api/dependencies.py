from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .auth import AuthenticatedUser, validate_access_token
from .config import get_settings
from .repositories import DatabaseRepository


bearer_scheme = HTTPBearer(auto_error=False)


def get_repository() -> DatabaseRepository:
    return DatabaseRepository(get_settings())


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> AuthenticatedUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticacao obrigatoria.",
        )

    return validate_access_token(credentials.credentials)
