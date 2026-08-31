from __future__ import annotations

import pytest
from fastapi import HTTPException

from rh_api.auth import AuthenticatedUser, reissue_token, validate_access_token
from rh_api.dependencies import ensure_resource_scope


def test_user_without_scope_is_unrestricted():
    user = AuthenticatedUser(username="sem.escopo")
    assert user.allows_operacao("CRF")
    assert user.allows_operacao(None)
    assert user.allows_operacao("")


def test_user_with_scope_is_restricted_to_assigned_operacoes():
    user = AuthenticatedUser(username="com.escopo", operacoes=frozenset({"CRF", "DAVITA"}))
    assert user.allows_operacao("CRF")
    assert user.allows_operacao("DAVITA")
    assert not user.allows_operacao("BRAVA")


def test_user_with_scope_still_allows_resources_without_operacao():
    # Recurso sem operação identificável (ex.: configuração global) não é
    # restringido — não há o que comparar.
    user = AuthenticatedUser(username="com.escopo", operacoes=frozenset({"CRF"}))
    assert user.allows_operacao(None)
    assert user.allows_operacao("")


def test_ensure_resource_scope_raises_403_when_out_of_scope():
    user = AuthenticatedUser(username="com.escopo", operacoes=frozenset({"CRF"}))
    with pytest.raises(HTTPException) as exc_info:
        ensure_resource_scope(user, "BRAVA")
    assert exc_info.value.status_code == 403


def test_ensure_resource_scope_allows_when_in_scope_or_unrestricted():
    scoped_user = AuthenticatedUser(username="com.escopo", operacoes=frozenset({"CRF"}))
    ensure_resource_scope(scoped_user, "CRF")  # não lança

    unrestricted_user = AuthenticatedUser(username="sem.escopo")
    ensure_resource_scope(unrestricted_user, "QUALQUER_OPERACAO")  # não lança


def test_operacoes_round_trip_through_the_signed_token():
    user = AuthenticatedUser(username="rh.escopo.token", operacoes=frozenset({"CRF", "NEWE"}))
    token = reissue_token(user)

    restored = validate_access_token(token)

    assert restored.operacoes == frozenset({"CRF", "NEWE"})
    assert not restored.allows_operacao("BRAVA")
    assert restored.allows_operacao("CRF")


def test_token_without_operacoes_claim_stays_unrestricted():
    # Usuário sem nenhuma operação atribuída (o caso de todo usuário hoje) —
    # zero regressão: continua acessando tudo que a permissão de módulo já permitia.
    user = AuthenticatedUser(username="rh.sem.escopo.token")
    token = reissue_token(user)

    restored = validate_access_token(token)

    assert restored.operacoes == frozenset()
    assert restored.allows_operacao("QUALQUER_OPERACAO")
