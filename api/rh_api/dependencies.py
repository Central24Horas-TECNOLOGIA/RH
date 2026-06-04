from __future__ import annotations

from collections.abc import Callable

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .auth import AuthenticatedUser, validate_access_token
from .config import get_settings
from .rbac import ACCESS_DENIED_MESSAGE, is_critical_permission
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
            detail="Autenticação obrigatória.",
        )

    return validate_access_token(credentials.credentials)


def _request_origin(request: Request | None) -> str:
    if request is None:
        return ""
    if request.client and request.client.host:
        return request.client.host
    return request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip()


def _log_permission_denied(
    *,
    repository: DatabaseRepository,
    user: AuthenticatedUser,
    request: Request | None,
    permissions: tuple[str, ...],
) -> None:
    try:
        repository.record_audit_log(
            user=user,
            modulo="Segurança",
            acao="acesso_negado",
            entidade="rota",
            entidade_id=f"{request.method} {request.url.path}" if request else "",
            valor_novo={"permissoes_requeridas": list(permissions)},
            origem=_request_origin(request),
            sucesso=False,
        )
    except Exception:
        return


def require_permissions(
    *permissions: str,
    require_all: bool = False,
) -> Callable:
    required_permissions = tuple(permission for permission in permissions if permission)

    def dependency(
        request: Request,
        user: AuthenticatedUser = Depends(get_current_user),
        repository: DatabaseRepository = Depends(get_repository),
    ) -> AuthenticatedUser:
        if not required_permissions:
            return user

        has_access = (
            all(user.has_permission(permission) for permission in required_permissions)
            if require_all
            else any(user.has_permission(permission) for permission in required_permissions)
        )
        if has_access:
            return user

        _log_permission_denied(
            repository=repository,
            user=user,
            request=request,
            permissions=required_permissions,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=ACCESS_DENIED_MESSAGE,
        )

    return dependency


def ensure_user_permission(
    user: AuthenticatedUser,
    permission: str,
    *,
    repository: DatabaseRepository | None = None,
    request: Request | None = None,
) -> None:
    if user.has_permission(permission):
        return

    if repository is not None:
        _log_permission_denied(
            repository=repository,
            user=user,
            request=request,
            permissions=(permission,),
        )

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=ACCESS_DENIED_MESSAGE,
    )


def audit_action(
    repository: DatabaseRepository,
    user: AuthenticatedUser | None,
    *,
    modulo: str,
    acao: str,
    entidade: str = "",
    entidade_id: str = "",
    valor_anterior=None,
    valor_novo=None,
    justificativa: str = "",
    request: Request | None = None,
    sucesso: bool = True,
) -> None:
    if not isinstance(user, AuthenticatedUser):
        return
    if not hasattr(repository, "record_audit_log"):
        return
    try:
        repository.record_audit_log(
            user=user,
            modulo=modulo,
            acao=acao,
            entidade=entidade,
            entidade_id=entidade_id,
            valor_anterior=valor_anterior,
            valor_novo=valor_novo,
            justificativa=justificativa,
            origem=_request_origin(request),
            sucesso=sucesso,
        )
    except Exception:
        return


def is_permission_critical(permission: str) -> bool:
    return is_critical_permission(permission)
