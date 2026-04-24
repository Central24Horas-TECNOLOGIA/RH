from __future__ import annotations

import logging
from datetime import datetime

from fastapi import HTTPException, status

from ..services.helpers import normalize_compare_text, normalize_text, rows_to_dicts
from ..services.pipeline import infer_pipeline_stage
from ..services.interviews import build_interview_message, normalize_interview_status
from ..services.process_flow import (
    build_process_closed_message,
    canonicalize_candidate_status,
    is_process_closed,
    status_allows_interview_scheduling,
)
from .bootstrap import (
    ensure_interviews_table,
    ensure_pipeline_columns,
    ensure_process_columns,
    ensure_process_reference_columns,
    get_process_row,
    resolve_process_row_for_related_record,
)


logger = logging.getLogger(__name__)


class InterviewRepositoryMixin:
    def list_interviews(
        self,
        id_processo: str = "",
        status_entrevista: str = "",
        search: str = "",
    ) -> list[dict]:
        def operation() -> list[dict]:
            conn = self._connect()
            try:
                cursor = conn.cursor()
                ensure_process_reference_columns(cursor)
                profile_map = self._get_candidate_profile_map(cursor)
                cursor.execute(
                    """
                    SELECT
                        id_entrevista,
                        id_processo,
                        id_processo_ref,
                        id_registro,
                        id_teste,
                        nome_candidato,
                        vaga,
                        data_entrevista,
                        status_entrevista,
                        link_agendamento,
                        observacoes_rh,
                        mensagem_base,
                        criado_em,
                        atualizado_em
                    FROM entrevistas_agendadas
                    ORDER BY CASE WHEN data_entrevista IS NULL THEN 1 ELSE 0 END, data_entrevista ASC, id_entrevista DESC
                    """
                )
                rows = rows_to_dicts(cursor, cursor.fetchall())
                rows = self._attach_process_context(
                    cursor,
                    rows,
                    timestamp_fields=["criado_em", "data_entrevista", "atualizado_em"],
                )
                process_filter = normalize_compare_text(id_processo)
                status_filter = normalize_compare_text(status_entrevista)
                search_filter = normalize_compare_text(search)
                result = []

                for item in rows:
                    safe_process_id = normalize_text(item.get("id_processo"))
                    profile = profile_map.get(normalize_text(item.get("id_teste")), {})
                    effective_link = normalize_text(item.get("link_agendamento")) or normalize_text(
                        item.get("link_agendamento_processo"),
                    )

                    enriched = {
                        **item,
                        "link_agendamento": effective_link,
                        "tags": profile.get("tags", []),
                        "habilidades": profile.get("habilidades", []),
                        "observacao_candidato_rh": profile.get("observacao_rh", ""),
                    }

                    if process_filter and process_filter not in normalize_compare_text(
                        normalize_text(enriched.get("id_processo_ref")) or safe_process_id,
                    ):
                        continue
                    if status_filter and status_filter != normalize_compare_text(enriched.get("status_entrevista")):
                        continue

                    if search_filter:
                        haystack = " ".join(
                            [
                                normalize_text(enriched.get("nome_candidato")),
                                normalize_text(enriched.get("vaga")),
                                safe_process_id,
                                " ".join(enriched.get("tags", [])),
                                " ".join(enriched.get("habilidades", [])),
                                normalize_text(enriched.get("observacoes_rh")),
                            ]
                        )
                        if search_filter not in normalize_compare_text(haystack):
                            continue

                    result.append(enriched)

                return result
            finally:
                conn.close()

        return self._run_with_deadlock_retry(
            "listar entrevistas",
            operation,
            retries=1,
            final_message="Nao foi possivel consultar a agenda de entrevistas agora por conta de concorrencia no banco. Tente novamente em instantes.",
        )

    def create_interview(self, data: dict) -> dict:
        def operation() -> dict:
            conn = self._connect()
            try:
                cursor = conn.cursor()
                ensure_pipeline_columns(cursor)
                ensure_interviews_table(cursor)
                ensure_process_columns(cursor)
                ensure_process_reference_columns(cursor)

                cursor.execute(
                    """
                    SELECT
                        id_registro,
                        id_processo,
                        id_processo_ref,
                        id_teste,
                        nome_candidato,
                        vaga,
                        status_candidato,
                        pontuacao_final,
                        data_prova,
                        origem,
                        etapa_pipeline,
                        data_atualizacao_pipeline
                    FROM candidatos_processos
                    WHERE id_registro = ?
                    """,
                    (int(data.get("id_registro") or 0),),
                )
                candidate_rows = rows_to_dicts(cursor, cursor.fetchall())
                if not candidate_rows:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidato do processo nao encontrado para agendamento.")
                candidate_row = candidate_rows[0]

                id_processo = normalize_text(data.get("id_processo")) or normalize_text(candidate_row.get("id_processo"))
                process_row = get_process_row(cursor, data.get("id_processo_ref") or candidate_row.get("id_processo_ref") or id_processo)
                if not process_row:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Processo seletivo nao encontrado para a entrevista.")
                if is_process_closed(process_row.get("status")):
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=build_process_closed_message("agendar entrevista", id_processo),
                    )
                if not status_allows_interview_scheduling(candidate_row.get("status_candidato")):
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="O candidato precisa estar qualificado para seguir ao agendamento da entrevista.",
                    )

                interview_date = data.get("data_entrevista") or datetime.now()
                link_agendamento = normalize_text(data.get("link_agendamento")) or normalize_text(process_row.get("link_agendamento"))
                interview_status = normalize_interview_status(data.get("status_entrevista"))
                observacoes_rh = normalize_text(data.get("observacoes_rh"))
                mensagem_base = build_interview_message(
                    candidate_name=candidate_row.get("nome_candidato"),
                    process_id=process_row.get("id_processo"),
                    vacancy_name=candidate_row.get("vaga") or process_row.get("vaga", ""),
                    interview_datetime=interview_date,
                    scheduling_link=link_agendamento,
                )

                cursor.execute(
                    """
                    INSERT INTO entrevistas_agendadas
                    (
                        id_processo,
                        id_processo_ref,
                        id_registro,
                        id_teste,
                        nome_candidato,
                        vaga,
                        data_entrevista,
                        status_entrevista,
                        link_agendamento,
                        observacoes_rh,
                        mensagem_base,
                        atualizado_em
                    )
                    OUTPUT INSERTED.id_entrevista
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE())
                    """,
                    (
                        process_row.get("id_processo", ""),
                        process_row.get("id_processo_ref", ""),
                        int(candidate_row.get("id_registro") or 0),
                        candidate_row.get("id_teste"),
                        candidate_row.get("nome_candidato"),
                        candidate_row.get("vaga") or process_row.get("vaga", ""),
                        interview_date,
                        interview_status,
                        link_agendamento,
                        observacoes_rh,
                        mensagem_base,
                    ),
                )
                id_entrevista = int(cursor.fetchone()[0])

                self._apply_candidate_status_update(
                    cursor,
                    current_row=candidate_row,
                    new_status=interview_status,
                    new_stage=infer_pipeline_stage(
                        interview_status,
                        candidate_row.get("origem"),
                        current_stage=candidate_row.get("etapa_pipeline"),
                    ),
                    data_movimentacao=interview_date.isoformat()
                    if isinstance(interview_date, datetime)
                    else datetime.now().isoformat(),
                )

                self._upsert_candidate_profile(
                    cursor,
                    id_teste=candidate_row.get("id_teste"),
                    nome_candidato=candidate_row.get("nome_candidato"),
                )
                conn.commit()
                logger.info(
                    "Entrevista %s agendada para o candidato %s.",
                    id_entrevista,
                    candidate_row.get("nome_candidato"),
                )
                return {"success": True, "id_entrevista": id_entrevista, "mensagem_base": mensagem_base}
            finally:
                conn.close()

        return self._run_with_deadlock_retry(
            "agendar entrevista",
            operation,
            retries=1,
            final_message="Nao foi possivel agendar a entrevista agora por conta de concorrencia no banco. Tente novamente em instantes.",
        )

    def update_interview(self, id_entrevista: int, data: dict) -> dict:
        def operation() -> dict:
            conn = self._connect()
            try:
                cursor = conn.cursor()
                ensure_interviews_table(cursor)
                ensure_pipeline_columns(cursor)
                ensure_process_columns(cursor)
                ensure_process_reference_columns(cursor)
                cursor.execute(
                    """
                    SELECT
                        id_entrevista,
                        id_processo,
                        id_processo_ref,
                        id_registro,
                        id_teste,
                        nome_candidato,
                        vaga,
                        data_entrevista,
                        status_entrevista,
                        link_agendamento,
                        observacoes_rh
                        ,
                        criado_em,
                        atualizado_em
                    FROM entrevistas_agendadas
                    WHERE id_entrevista = ?
                    """,
                    (id_entrevista,),
                )
                current_rows = rows_to_dicts(cursor, cursor.fetchall())
                if not current_rows:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entrevista nao encontrada.")
                current = current_rows[0]

                process_row = resolve_process_row_for_related_record(
                    cursor,
                    id_processo=current.get("id_processo"),
                    id_processo_ref=current.get("id_processo_ref", ""),
                    timestamp_values=[
                        current.get("data_entrevista"),
                        current.get("atualizado_em"),
                    ],
                ) or get_process_row(cursor, current.get("id_processo_ref") or current.get("id_processo")) or {}
                if is_process_closed(process_row.get("status")):
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=build_process_closed_message("atualizar a entrevista", current.get("id_processo")),
                    )
                interview_date = data.get("data_entrevista", current.get("data_entrevista")) or current.get("data_entrevista") or datetime.now()
                interview_status = normalize_interview_status(
                    data.get("status_entrevista", current.get("status_entrevista")),
                )
                link_agendamento = (
                    normalize_text(data.get("link_agendamento"))
                    or normalize_text(current.get("link_agendamento"))
                    or normalize_text(process_row.get("link_agendamento"))
                )
                observacoes_rh = (
                    normalize_text(data.get("observacoes_rh"))
                    if "observacoes_rh" in data
                    else normalize_text(current.get("observacoes_rh"))
                )
                mensagem_base = build_interview_message(
                    candidate_name=current.get("nome_candidato"),
                    process_id=current.get("id_processo"),
                    vacancy_name=current.get("vaga"),
                    interview_datetime=interview_date,
                    scheduling_link=link_agendamento,
                )

                cursor.execute(
                    """
                    UPDATE entrevistas_agendadas
                    SET
                        data_entrevista = ?,
                        status_entrevista = ?,
                        link_agendamento = ?,
                        observacoes_rh = ?,
                        mensagem_base = ?,
                        id_processo_ref = ?,
                        atualizado_em = GETDATE()
                    WHERE id_entrevista = ?
                    """,
                    (
                        interview_date,
                        interview_status,
                        link_agendamento,
                        observacoes_rh,
                        mensagem_base,
                        process_row.get("id_processo_ref", "") or current.get("id_processo_ref", ""),
                        id_entrevista,
                    ),
                )
                if int(current.get("id_registro") or 0):
                    cursor.execute(
                        """
                        SELECT
                            id_registro,
                            id_processo,
                            id_processo_ref,
                            id_teste,
                            nome_candidato,
                            vaga,
                            status_candidato,
                            pontuacao_final,
                            data_prova,
                            origem,
                            etapa_pipeline,
                            data_atualizacao_pipeline
                        FROM candidatos_processos
                        WHERE id_registro = ?
                        """,
                        (int(current.get("id_registro")),),
                    )
                    candidate_rows = rows_to_dicts(cursor, cursor.fetchall())
                    candidate_row = candidate_rows[0] if candidate_rows else None
                    if candidate_row and canonicalize_candidate_status(candidate_row.get("status_candidato")) != canonicalize_candidate_status(interview_status):
                        self._apply_candidate_status_update(
                            cursor,
                            current_row=candidate_row,
                            new_status=interview_status,
                            new_stage=infer_pipeline_stage(
                                interview_status,
                                candidate_row.get("origem"),
                                current_stage=candidate_row.get("etapa_pipeline"),
                            ),
                            data_movimentacao=interview_date.isoformat() if isinstance(interview_date, datetime) else str(interview_date),
                        )
                conn.commit()
                logger.info("Entrevista %s atualizada para o status '%s'.", id_entrevista, interview_status)
                return {"success": True, "mensagem_base": mensagem_base}
            finally:
                conn.close()

        return self._run_with_deadlock_retry(
            f"atualizar entrevista {id_entrevista}",
            operation,
            retries=1,
            final_message="Nao foi possivel atualizar a entrevista agora por conta de concorrencia no banco. Tente novamente em instantes.",
        )
