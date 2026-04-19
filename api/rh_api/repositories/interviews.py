from __future__ import annotations

import logging
from datetime import datetime

from fastapi import HTTPException, status

from ..services.helpers import normalize_compare_text, normalize_text, rows_to_dicts
from ..services.interviews import build_interview_message, normalize_interview_status
from ..services.pipeline import map_pipeline_stage_to_status, normalize_pipeline_stage
from .bootstrap import ensure_interviews_table, ensure_pipeline_columns, ensure_process_columns, get_process_row


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
                process_map = self._get_process_map(cursor)
                profile_map = self._get_candidate_profile_map(cursor)
                cursor.execute(
                    """
                    SELECT
                        id_entrevista,
                        id_processo,
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
                    ORDER BY data_entrevista ASC, id_entrevista DESC
                    """
                )
                rows = rows_to_dicts(cursor, cursor.fetchall())
                process_filter = normalize_compare_text(id_processo)
                status_filter = normalize_compare_text(status_entrevista)
                search_filter = normalize_compare_text(search)
                result = []

                for item in rows:
                    safe_process_id = normalize_text(item.get("id_processo"))
                    process_row = process_map.get(safe_process_id, {})
                    profile = profile_map.get(normalize_text(item.get("id_teste")), {})
                    effective_link = normalize_text(item.get("link_agendamento")) or normalize_text(process_row.get("link_agendamento"))

                    enriched = {
                        **item,
                        "link_agendamento": effective_link,
                        "link_agendamento_processo": normalize_text(process_row.get("link_agendamento")),
                        "tags": profile.get("tags", []),
                        "habilidades": profile.get("habilidades", []),
                        "observacao_candidato_rh": profile.get("observacao_rh", ""),
                    }

                    if process_filter and process_filter not in normalize_compare_text(safe_process_id):
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

                cursor.execute(
                    """
                    SELECT
                        id_registro,
                        id_processo,
                        id_teste,
                        nome_candidato,
                        vaga,
                        status_candidato,
                        pontuacao_final,
                        origem,
                        etapa_pipeline
                    FROM candidatos_processos
                    WHERE id_registro = ?
                    """,
                    (int(data.get("id_registro") or 0),),
                )
                candidate_row = cursor.fetchone()
                if not candidate_row:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidato do processo nao encontrado para agendamento.")

                id_processo = normalize_text(data.get("id_processo")) or normalize_text(candidate_row[1])
                process_row = get_process_row(cursor, id_processo)
                if not process_row:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Processo seletivo nao encontrado para a entrevista.")

                interview_date = data.get("data_entrevista")
                link_agendamento = normalize_text(data.get("link_agendamento")) or normalize_text(process_row.get("link_agendamento"))
                interview_status = normalize_interview_status(data.get("status_entrevista"))
                observacoes_rh = normalize_text(data.get("observacoes_rh"))
                mensagem_base = build_interview_message(
                    candidate_name=candidate_row[3],
                    process_id=id_processo,
                    vacancy_name=candidate_row[4] or process_row.get("vaga", ""),
                    interview_datetime=interview_date,
                    scheduling_link=link_agendamento,
                )

                cursor.execute(
                    """
                    INSERT INTO entrevistas_agendadas
                    (
                        id_processo,
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
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE())
                    """,
                    (
                        id_processo,
                        int(candidate_row[0]),
                        candidate_row[2],
                        candidate_row[3],
                        candidate_row[4] or process_row.get("vaga", ""),
                        interview_date,
                        interview_status,
                        link_agendamento,
                        observacoes_rh,
                        mensagem_base,
                    ),
                )
                id_entrevista = int(cursor.fetchone()[0])

                current_stage = normalize_pipeline_stage(candidate_row[8])
                if current_stage not in {"Entrevista", "Aprovado", "Reprovado"}:
                    self._apply_candidate_status_update(
                        cursor,
                        current_row=candidate_row,
                        new_status=map_pipeline_stage_to_status("Entrevista", candidate_row[5]),
                        new_stage="Entrevista",
                        data_movimentacao=interview_date.isoformat() if isinstance(interview_date, datetime) else str(interview_date),
                    )

                self._upsert_candidate_profile(
                    cursor,
                    id_teste=candidate_row[2],
                    nome_candidato=candidate_row[3],
                )
                conn.commit()
                logger.info("Entrevista %s agendada para o candidato %s.", id_entrevista, candidate_row[3])
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
                ensure_process_columns(cursor)
                cursor.execute(
                    """
                    SELECT
                        id_entrevista,
                        id_processo,
                        id_teste,
                        nome_candidato,
                        vaga,
                        data_entrevista,
                        status_entrevista,
                        link_agendamento,
                        observacoes_rh
                    FROM entrevistas_agendadas
                    WHERE id_entrevista = ?
                    """,
                    (id_entrevista,),
                )
                current = cursor.fetchone()
                if not current:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entrevista nao encontrada.")

                process_row = get_process_row(cursor, current[1]) or {}
                interview_date = data.get("data_entrevista", current[5])
                interview_status = normalize_interview_status(data.get("status_entrevista", current[6]))
                link_agendamento = normalize_text(data.get("link_agendamento")) or normalize_text(current[7]) or normalize_text(process_row.get("link_agendamento"))
                observacoes_rh = normalize_text(data.get("observacoes_rh")) if "observacoes_rh" in data else normalize_text(current[8])
                mensagem_base = build_interview_message(
                    candidate_name=current[3],
                    process_id=current[1],
                    vacancy_name=current[4],
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
                        atualizado_em = GETDATE()
                    WHERE id_entrevista = ?
                    """,
                    (
                        interview_date,
                        interview_status,
                        link_agendamento,
                        observacoes_rh,
                        mensagem_base,
                        id_entrevista,
                    ),
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
