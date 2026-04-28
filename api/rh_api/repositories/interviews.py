from __future__ import annotations

import logging
from datetime import date, datetime, time, timedelta

from fastapi import HTTPException, status

from ..services.helpers import normalize_compare_text, normalize_text, rows_to_dicts
from ..services.interviews import build_interview_message, normalize_interview_status
from ..services.pipeline import infer_pipeline_stage
from ..services.process_flow import (
    CANDIDATE_STATUS_CONFIRMED,
    CANDIDATE_STATUS_RESCHEDULED,
    CANDIDATE_STATUS_SCHEDULED,
    build_process_closed_message,
    canonicalize_candidate_status,
    is_process_closed,
    status_allows_interview_scheduling,
)
from .bootstrap import (
    ensure_interview_slots_table,
    ensure_interviews_table,
    ensure_pipeline_columns,
    ensure_process_columns,
    ensure_process_reference_columns,
    get_process_row,
    resolve_process_row_for_related_record,
)


logger = logging.getLogger(__name__)

SLOT_STATUS_AVAILABLE = "Disponivel"
SLOT_STATUS_OCCUPIED = "Ocupado"
SLOT_STATUS_BLOCKED = "Bloqueado"


class InterviewRepositoryMixin:
    def _parse_slot_datetime(self, data: str, horario: str) -> datetime:
        try:
            parsed_date = date.fromisoformat(normalize_text(data))
            parsed_time = time.fromisoformat(normalize_text(horario))
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Informe data e horario em formato valido para os slots.",
            ) from exc

        return datetime.combine(parsed_date, parsed_time)

    def _normalize_slot_status(self, value: str | None) -> str:
        safe_value = normalize_compare_text(value)
        if safe_value == "ocupado":
            return SLOT_STATUS_OCCUPIED
        if safe_value == "bloqueado":
            return SLOT_STATUS_BLOCKED
        return SLOT_STATUS_AVAILABLE

    def _select_slot_for_update(self, cursor, id_slot: int) -> dict:
        cursor.execute(
            """
            SELECT
                id_slot,
                id_processo,
                id_processo_ref,
                inicio,
                fim,
                status_slot,
                id_entrevista,
                observacoes_rh
            FROM entrevista_slots WITH (UPDLOCK, ROWLOCK)
            WHERE id_slot = ?
            """,
            (int(id_slot or 0),),
        )
        rows = rows_to_dicts(cursor, cursor.fetchall())
        if not rows:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Horario de entrevista nao encontrado.")
        return rows[0]

    def _assert_slot_available(self, slot: dict, *, current_interview_id: int | None = None) -> None:
        linked_interview_id = int(slot.get("id_entrevista") or 0)
        if linked_interview_id and linked_interview_id != int(current_interview_id or 0):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Este horario ja esta ocupado por outro candidato.")

        if self._normalize_slot_status(slot.get("status_slot")) != SLOT_STATUS_AVAILABLE and linked_interview_id != int(current_interview_id or 0):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Este horario nao esta disponivel para agendamento.")

    def _assert_slot_matches_process(self, slot: dict, process_row: dict) -> None:
        slot_process_ref = normalize_text(slot.get("id_processo_ref"))
        slot_process_id = normalize_text(slot.get("id_processo"))
        process_ref = normalize_text(process_row.get("id_processo_ref"))
        process_id = normalize_text(process_row.get("id_processo"))

        if slot_process_ref and slot_process_ref != process_ref:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="O horario selecionado pertence a outro processo.")
        if not slot_process_ref and slot_process_id and slot_process_id != process_id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="O horario selecionado pertence a outro processo.")

    def _release_slot(self, cursor, id_slot: int | None, *, id_entrevista: int | None = None) -> None:
        if not int(id_slot or 0):
            return

        cursor.execute(
            """
            UPDATE entrevista_slots
            SET status_slot = ?, id_entrevista = NULL, atualizado_em = GETDATE()
            WHERE id_slot = ? AND (id_entrevista = ? OR id_entrevista IS NULL)
            """,
            (SLOT_STATUS_AVAILABLE, int(id_slot), int(id_entrevista or 0)),
        )

    def _occupy_slot(self, cursor, id_slot: int | None, id_entrevista: int) -> None:
        if not int(id_slot or 0):
            return

        cursor.execute(
            """
            UPDATE entrevista_slots
            SET status_slot = ?, id_entrevista = ?, atualizado_em = GETDATE()
            WHERE id_slot = ?
            """,
            (SLOT_STATUS_OCCUPIED, int(id_entrevista), int(id_slot)),
        )

    def _assert_datetime_without_conflict(
        self,
        cursor,
        interview_date,
        *,
        current_interview_id: int | None = None,
    ) -> None:
        if not interview_date:
            return

        cursor.execute(
            """
            SELECT COUNT(1)
            FROM entrevistas_agendadas
            WHERE data_entrevista = ?
              AND id_entrevista <> ?
              AND status_entrevista IN (?, ?, ?)
            """,
            (
                interview_date,
                int(current_interview_id or 0),
                CANDIDATE_STATUS_SCHEDULED,
                CANDIDATE_STATUS_CONFIRMED,
                CANDIDATE_STATUS_RESCHEDULED,
            ),
        )
        if int(cursor.fetchone()[0] or 0):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ja existe entrevista neste horario.")

    def list_interview_slots(
        self,
        id_processo: str = "",
        date: str = "",
        status_slot: str = "",
    ) -> list[dict]:
        def operation() -> list[dict]:
            conn = self._connect()
            try:
                cursor = conn.cursor()
                ensure_interviews_table(cursor)
                ensure_interview_slots_table(cursor)
                ensure_process_reference_columns(cursor)

                cursor.execute(
                    """
                    SELECT
                        s.id_slot,
                        s.id_processo,
                        s.id_processo_ref,
                        s.inicio,
                        s.fim,
                        s.status_slot,
                        s.id_entrevista,
                        s.observacoes_rh,
                        s.criado_em,
                        s.atualizado_em,
                        e.id_registro,
                        e.id_teste,
                        e.nome_candidato,
                        e.vaga,
                        e.status_entrevista
                    FROM entrevista_slots s
                    LEFT JOIN entrevistas_agendadas e ON e.id_entrevista = s.id_entrevista
                    ORDER BY s.inicio ASC, s.id_slot ASC
                    """
                )
                rows = rows_to_dicts(cursor, cursor.fetchall())
                rows = self._attach_process_context(
                    cursor,
                    rows,
                    timestamp_fields=["inicio", "atualizado_em"],
                )

                process_filter = normalize_compare_text(id_processo)
                status_filter = normalize_compare_text(status_slot)
                date_filter = normalize_text(date)
                result = []

                for item in rows:
                    if process_filter:
                        process_value = normalize_text(item.get("id_processo_ref")) or normalize_text(item.get("id_processo"))
                        if process_value and process_filter not in normalize_compare_text(process_value):
                            continue

                    if status_filter and status_filter != normalize_compare_text(item.get("status_slot")):
                        continue

                    if date_filter:
                        start_value = item.get("inicio")
                        start_date = start_value.date().isoformat() if isinstance(start_value, datetime) else normalize_text(start_value)[:10]
                        if start_date != date_filter:
                            continue

                    result.append(item)

                return result
            finally:
                conn.close()

        return self._run_with_deadlock_retry(
            "listar slots de entrevista",
            operation,
            retries=1,
            final_message="Nao foi possivel consultar os horarios de entrevista agora. Tente novamente em instantes.",
        )

    def create_interview_slots(self, data: dict) -> dict:
        def operation() -> dict:
            conn = self._connect()
            try:
                cursor = conn.cursor()
                ensure_interviews_table(cursor)
                ensure_interview_slots_table(cursor)
                ensure_process_columns(cursor)
                ensure_process_reference_columns(cursor)

                process_row = None
                process_reference = normalize_text(data.get("id_processo_ref")) or normalize_text(data.get("id_processo"))
                if process_reference:
                    process_row = get_process_row(cursor, process_reference)
                    if not process_row:
                        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Processo seletivo nao encontrado para criar horarios.")
                    if is_process_closed(process_row.get("status")):
                        raise HTTPException(
                            status_code=status.HTTP_409_CONFLICT,
                            detail=build_process_closed_message("criar horarios de entrevista", process_row.get("id_processo")),
                        )

                start = self._parse_slot_datetime(data.get("data"), data.get("hora_inicio"))
                end = self._parse_slot_datetime(data.get("data"), data.get("hora_fim"))
                duration = int(data.get("duracao_minutos") or 30)

                if end <= start:
                    raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="A hora final deve ser maior que a hora inicial.")

                created = 0
                skipped = 0
                current = start
                while current + timedelta(minutes=duration) <= end:
                    slot_end = current + timedelta(minutes=duration)
                    cursor.execute(
                        """
                        SELECT COUNT(1)
                        FROM entrevista_slots
                        WHERE inicio < ? AND fim > ?
                        """,
                        (slot_end, current),
                    )
                    has_conflict = int(cursor.fetchone()[0] or 0) > 0
                    if has_conflict:
                        skipped += 1
                    else:
                        cursor.execute(
                            """
                            INSERT INTO entrevista_slots
                            (
                                id_processo,
                                id_processo_ref,
                                inicio,
                                fim,
                                status_slot,
                                observacoes_rh
                            )
                            VALUES (?, ?, ?, ?, ?, ?)
                            """,
                            (
                                process_row.get("id_processo", "") if process_row else "",
                                process_row.get("id_processo_ref", "") if process_row else "",
                                current,
                                slot_end,
                                SLOT_STATUS_AVAILABLE,
                                normalize_text(data.get("observacoes_rh")),
                            ),
                        )
                        created += 1
                    current = slot_end

                conn.commit()
                return {"success": True, "created": created, "skipped": skipped}
            finally:
                conn.close()

        return self._run_with_deadlock_retry(
            "criar slots de entrevista",
            operation,
            retries=1,
            final_message="Nao foi possivel criar os horarios agora por conta de concorrencia no banco. Tente novamente em instantes.",
        )

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
                ensure_interviews_table(cursor)
                ensure_interview_slots_table(cursor)
                ensure_process_reference_columns(cursor)
                profile_map = self._get_candidate_profile_map(cursor)
                cursor.execute(
                    """
                    SELECT
                        e.id_entrevista,
                        e.id_slot,
                        e.id_processo,
                        e.id_processo_ref,
                        e.id_registro,
                        e.id_teste,
                        e.nome_candidato,
                        e.vaga,
                        e.data_entrevista,
                        e.status_entrevista,
                        e.link_agendamento,
                        e.observacoes_rh,
                        e.mensagem_base,
                        e.criado_em,
                        e.atualizado_em,
                        s.inicio AS slot_inicio,
                        s.fim AS slot_fim,
                        s.status_slot
                    FROM entrevistas_agendadas e
                    LEFT JOIN entrevista_slots s ON s.id_slot = e.id_slot
                    ORDER BY CASE WHEN e.data_entrevista IS NULL THEN 1 ELSE 0 END, e.data_entrevista ASC, e.id_entrevista DESC
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
                    effective_link = normalize_text(item.get("link_agendamento"))

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
                ensure_interview_slots_table(cursor)
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

                id_slot = int(data.get("id_slot") or 0)
                slot_row = self._select_slot_for_update(cursor, id_slot) if id_slot else None
                if slot_row:
                    self._assert_slot_available(slot_row)
                    self._assert_slot_matches_process(slot_row, process_row)
                    interview_date = slot_row.get("inicio")
                else:
                    interview_date = data.get("data_entrevista") or datetime.now()
                    self._assert_datetime_without_conflict(cursor, interview_date)

                link_agendamento = normalize_text(data.get("link_agendamento"))
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
                        id_slot,
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
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE())
                    """,
                    (
                        id_slot or None,
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
                self._occupy_slot(cursor, id_slot, id_entrevista)

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
                return {
                    "success": True,
                    "id_entrevista": id_entrevista,
                    "id_slot": id_slot or None,
                    "mensagem_base": mensagem_base,
                }
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
                ensure_interview_slots_table(cursor)
                ensure_pipeline_columns(cursor)
                ensure_process_columns(cursor)
                ensure_process_reference_columns(cursor)
                cursor.execute(
                    """
                    SELECT
                        id_entrevista,
                        id_slot,
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

                current_slot_id = int(current.get("id_slot") or 0)
                new_slot_id = int(data.get("id_slot") or 0) if "id_slot" in data else current_slot_id
                slot_changed = new_slot_id != current_slot_id

                if slot_changed and new_slot_id:
                    slot_row = self._select_slot_for_update(cursor, new_slot_id)
                    self._assert_slot_available(slot_row, current_interview_id=id_entrevista)
                    self._assert_slot_matches_process(slot_row, process_row)
                    interview_date = slot_row.get("inicio")
                    interview_status = normalize_interview_status(
                        data.get("status_entrevista") or CANDIDATE_STATUS_RESCHEDULED,
                    )
                else:
                    interview_date = data.get("data_entrevista", current.get("data_entrevista")) or current.get("data_entrevista") or datetime.now()
                    interview_status = normalize_interview_status(
                        data.get("status_entrevista", current.get("status_entrevista")),
                    )
                    if not new_slot_id:
                        self._assert_datetime_without_conflict(
                            cursor,
                            interview_date,
                            current_interview_id=id_entrevista,
                        )

                link_agendamento = (
                    normalize_text(data.get("link_agendamento"))
                    if "link_agendamento" in data
                    else normalize_text(current.get("link_agendamento"))
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
                        id_slot = ?,
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
                        new_slot_id or None,
                        interview_date,
                        interview_status,
                        link_agendamento,
                        observacoes_rh,
                        mensagem_base,
                        process_row.get("id_processo_ref", "") or current.get("id_processo_ref", ""),
                        id_entrevista,
                    ),
                )
                if slot_changed:
                    self._release_slot(cursor, current_slot_id, id_entrevista=id_entrevista)
                    self._occupy_slot(cursor, new_slot_id, id_entrevista)

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
