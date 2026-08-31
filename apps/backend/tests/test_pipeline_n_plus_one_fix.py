from __future__ import annotations

from unittest.mock import MagicMock, patch

from rh_api.repositories.base import BaseRepository


def _repo() -> BaseRepository:
    return BaseRepository.__new__(BaseRepository)


def test_attach_process_context_queries_each_distinct_process_only_once():
    repo = _repo()
    cursor = MagicMock()

    # 6 linhas de candidato, mas só 2 processos distintos — o comportamento
    # antigo (N+1) faria 6 chamadas a get_process_rows; o correto faz 2.
    rows = [
        {"id_processo": "P1", "id_processo_ref": "", "data_prova": None, "data_atualizacao_pipeline": None}
        for _ in range(4)
    ] + [
        {"id_processo": "P2", "id_processo_ref": "", "data_prova": None, "data_atualizacao_pipeline": None}
        for _ in range(2)
    ]

    with patch(
        "rh_api.repositories.base.get_process_rows",
        return_value=[{"id_processo": "P1", "status": "Aberto", "link_agendamento": "", "data_criacao": "2026-01-01"}],
    ) as mock_get_rows:
        repo._attach_process_context(cursor, rows, timestamp_fields=["data_prova", "data_atualizacao_pipeline"])

    called_process_ids = {call.args[1] for call in mock_get_rows.call_args_list}
    assert mock_get_rows.call_count == 2
    assert called_process_ids == {"P1", "P2"}


def test_attach_process_context_still_attaches_correct_status_per_row():
    repo = _repo()
    cursor = MagicMock()
    rows = [{"id_processo": "P1", "id_processo_ref": "", "data_prova": None, "data_atualizacao_pipeline": None}]

    with patch(
        "rh_api.repositories.base.get_process_rows",
        return_value=[{"id_processo": "P1", "status": "Aberto", "link_agendamento": "https://exemplo", "data_criacao": "2026-01-01"}],
    ):
        result = repo._attach_process_context(cursor, rows, timestamp_fields=["data_prova", "data_atualizacao_pipeline"])

    assert result[0]["status_processo"] == "Aberto"
    assert result[0]["link_agendamento_processo"] == "https://exemplo"


def test_hydrate_pipeline_fields_batches_updates_by_target_stage():
    repo = _repo()
    cursor = MagicMock()
    cursor.connection = MagicMock()

    # 3 candidatos cuja etapa salva não bate com a etapa inferida — todos
    # "Reprovado" inferem a mesma etapa terminal, então devem virar 1 UPDATE
    # só (não 3).
    candidates = [
        {"id_registro": 1, "status_candidato": "Reprovado", "origem": "", "etapa_pipeline": "Triagem"},
        {"id_registro": 2, "status_candidato": "Reprovado", "origem": "", "etapa_pipeline": "Prova"},
        {"id_registro": 3, "status_candidato": "Reprovado", "origem": "", "etapa_pipeline": "Entrevista"},
    ]

    repo._hydrate_pipeline_fields(cursor, candidates)

    update_calls = [call for call in cursor.execute.call_args_list if "UPDATE candidatos_processos" in call.args[0]]
    assert len(update_calls) == 1
    sql, params = update_calls[0].args
    assert "IN (?, ?, ?)" in sql
    assert params[2:] == (1, 2, 3)
    cursor.connection.commit.assert_called_once()


def test_hydrate_pipeline_fields_does_not_touch_db_when_nothing_is_stale():
    repo = _repo()
    cursor = MagicMock()
    cursor.connection = MagicMock()

    candidates = [
        {"id_registro": 1, "status_candidato": "Reprovado", "origem": "", "etapa_pipeline": "Reprovado"},
    ]

    repo._hydrate_pipeline_fields(cursor, candidates)

    cursor.execute.assert_not_called()
    cursor.connection.commit.assert_not_called()
