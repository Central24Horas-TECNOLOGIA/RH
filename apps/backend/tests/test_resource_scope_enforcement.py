from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from rh_api.auth import AuthenticatedUser
from rh_api.repositories.base import BaseRepository
from rh_api.repositories.interviews import InterviewRepositoryMixin
from rh_api.repositories.processes import ProcessRepositoryMixin


class _RepoUnderTest(ProcessRepositoryMixin, InterviewRepositoryMixin, BaseRepository):
    """Só as duas mixins sob teste — sem __init__ real de DatabaseRepository."""

    def __init__(self) -> None:
        self.logger = MagicMock()

    def _connect(self):
        conn = MagicMock()
        conn.cursor.return_value = MagicMock()
        return conn


def test_update_process_blocks_user_out_of_scope():
    repo = _RepoUnderTest()
    user = AuthenticatedUser(username="gestor.crf", operacoes=frozenset({"CRF"}))

    with patch(
        "rh_api.repositories.processes.get_process_row",
        return_value={"id_processo": "P1", "operacao": "BRAVA"},
    ):
        with pytest.raises(HTTPException) as exc_info:
            repo.update_process("P1", {"vaga": "Nova vaga"}, user=user)

    assert exc_info.value.status_code == 403


def test_update_process_allows_user_in_scope_to_reach_the_update_statement():
    repo = _RepoUnderTest()
    user = AuthenticatedUser(username="gestor.crf", operacoes=frozenset({"CRF"}))

    with patch(
        "rh_api.repositories.processes.get_process_row",
        return_value={"id_processo": "P1", "operacao": "CRF"},
    ):
        with patch(
            "rh_api.repositories.processes.build_process_where_clause",
            return_value=("id_processo = ?", ["P1"]),
        ):
            # Sem exceção de escopo — o teste termina em outro erro (mock sem
            # dado real de retorno do UPDATE), o que já confirma que passou
            # pela checagem de escopo sem ser bloqueado.
            try:
                repo.update_process("P1", {"vaga": "Nova vaga"}, user=user)
            except HTTPException as exc:
                assert exc.status_code != 403


def test_update_process_with_no_user_keeps_current_behavior_unrestricted():
    repo = _RepoUnderTest()

    with patch(
        "rh_api.repositories.processes.get_process_row",
        return_value={"id_processo": "P1", "operacao": "BRAVA"},
    ):
        with patch(
            "rh_api.repositories.processes.build_process_where_clause",
            return_value=("id_processo = ?", ["P1"]),
        ):
            try:
                repo.update_process("P1", {"vaga": "Nova vaga"})
            except HTTPException as exc:
                assert exc.status_code != 403


def test_update_interview_slot_blocks_user_out_of_scope():
    repo = _RepoUnderTest()
    user = AuthenticatedUser(username="gestor.crf", operacoes=frozenset({"CRF"}))

    with patch.object(
        repo,
        "_select_slot_for_update",
        return_value={"id_slot": 1, "id_processo": "P1", "capacidade_total": 2},
    ), patch.object(repo, "_run_with_deadlock_retry", side_effect=lambda _name, op, **_kw: op()), patch(
        "rh_api.repositories.interviews.get_process_row",
        return_value={"id_processo": "P1", "operacao": "BRAVA"},
    ):
        with pytest.raises(HTTPException) as exc_info:
            repo.update_interview_slot(1, {"capacidade_total": 2}, user=user)

    assert exc_info.value.status_code == 403


def test_update_interview_slot_with_no_user_keeps_current_behavior_unrestricted():
    repo = _RepoUnderTest()

    with patch.object(
        repo,
        "_select_slot_for_update",
        return_value={"id_slot": 1, "id_processo": "P1", "capacidade_total": 2},
    ), patch.object(repo, "_run_with_deadlock_retry", side_effect=lambda _name, op, **_kw: op()), patch.object(
        repo, "_count_slot_occupancy", return_value=0
    ), patch.object(repo, "_normalize_slot_status", return_value="Disponivel"), patch.object(
        repo, "_refresh_slot_status"
    ), patch.object(
        repo, "_calculate_slot_status", return_value="Disponivel"
    ):
        result = repo.update_interview_slot(1, {"capacidade_total": 3})

    assert result["success"] is True
