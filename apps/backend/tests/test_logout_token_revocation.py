from __future__ import annotations

import pytest
from fastapi import HTTPException

from rh_api.auth import AuthenticatedUser, reissue_token, revoke_access_token, validate_access_token


def _issue_token(username: str = "rh.teste.revogacao") -> str:
    user = AuthenticatedUser(username=username, id_usuario=1)
    return reissue_token(user)


def test_token_is_valid_before_logout():
    token = _issue_token()
    user = validate_access_token(token)
    assert user.username == "rh.teste.revogacao"


def test_token_is_rejected_after_revocation():
    token = _issue_token()
    validate_access_token(token)  # confirma que era válido antes de revogar

    revoke_access_token(token)

    with pytest.raises(HTTPException) as exc_info:
        validate_access_token(token)
    assert exc_info.value.status_code == 401


def test_revoking_one_token_does_not_affect_a_different_valid_token():
    token_a = _issue_token("usuario.a")
    token_b = _issue_token("usuario.b")

    revoke_access_token(token_a)

    with pytest.raises(HTTPException):
        validate_access_token(token_a)

    # Token de outro usuário/outra sessão continua válido normalmente.
    assert validate_access_token(token_b).username == "usuario.b"


def test_revoke_access_token_is_a_no_op_for_garbage_input():
    # Não deve lançar exceção nem quebrar o denylist para tokens malformados.
    revoke_access_token("")
    revoke_access_token("token-sem-ponto-separador")
    revoke_access_token("payload-invalido.assinatura-qualquer")
