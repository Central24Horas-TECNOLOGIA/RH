from __future__ import annotations

import logging
from datetime import datetime

from fastapi import HTTPException, status

from ..services.helpers import normalize_compare_text, normalize_text, rows_to_dicts
from ..services.pipeline import infer_pipeline_stage, map_pipeline_stage_to_status, normalize_pipeline_stage
from ..services.process_flow import (
    CANDIDATE_STATUS_ANALYSIS,
    CANDIDATE_STATUS_APPROVED,
    CANDIDATE_STATUS_ATTENDED,
    CANDIDATE_STATUS_CONFIRMED,
    CANDIDATE_STATUS_ELIMINATED,
    CANDIDATE_STATUS_MISSED,
    CANDIDATE_STATUS_NOT_QUALIFIED,
    CANDIDATE_STATUS_QUALIFIED,
    CANDIDATE_STATUS_SCHEDULED,
    CANDIDATE_STATUS_TALENT_BANK,
    CANDIDATE_STATUS_WITHDREW,
    build_approved_candidate_locked_message,
    build_process_closed_message,
    build_terminal_candidate_locked_message,
    canonicalize_candidate_status,
    get_candidate_visible_status,
    is_active_candidate_status,
    is_process_closed,
    is_terminal_candidate_status,
    normalize_process_status,
)
from .bootstrap import (
    build_process_where_clause,
    ensure_pipeline_columns,
    ensure_process_columns,
    ensure_process_reference_columns,
    generate_unique_process_id,
    get_process_row,
    get_process_rows,
    insert_candidate_process_record,
    process_auto_close_if_full,
    resolve_process_row_for_related_record,
)


logger = logging.getLogger(__name__)


class ProcessRepositoryMixin:
    @staticmethod
    def _preserve_existing_process_status(current_status: str, requested_status: str) -> str:
        current = canonicalize_candidate_status(current_status)
        requested = canonicalize_candidate_status(requested_status)

        if requested in {
            CANDIDATE_STATUS_APPROVED,
            CANDIDATE_STATUS_ELIMINATED,
            CANDIDATE_STATUS_TALENT_BANK,
            CANDIDATE_STATUS_WITHDREW,
        }:
            return requested

        if current in {
            CANDIDATE_STATUS_SCHEDULED,
            CANDIDATE_STATUS_CONFIRMED,
            CANDIDATE_STATUS_ATTENDED,
            CANDIDATE_STATUS_MISSED,
            CANDIDATE_STATUS_APPROVED,
            CANDIDATE_STATUS_ELIMINATED,
            CANDIDATE_STATUS_TALENT_BANK,
            CANDIDATE_STATUS_WITHDREW,
        } and requested in {
            CANDIDATE_STATUS_ANALYSIS,
            CANDIDATE_STATUS_QUALIFIED,
        }:
            return current

        return requested

    def list_processes(self) -> list[dict]:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_process_columns(cursor)
            ensure_process_reference_columns(cursor)
            rows = get_process_rows(cursor)
            if not rows:
                return rows

            cursor.execute(
                """
                SELECT
                    id_processo,
                    id_processo_ref,
                    status_candidato,
                    etapa_pipeline
                FROM candidatos_processos
                """
            )
            candidatos = rows_to_dicts(cursor, cursor.fetchall())
            terminal_statuses = {
                CANDIDATE_STATUS_APPROVED,
                CANDIDATE_STATUS_ELIMINATED,
                CANDIDATE_STATUS_NOT_QUALIFIED,
                CANDIDATE_STATUS_TALENT_BANK,
                CANDIDATE_STATUS_WITHDREW,
            }
            contagem_por_ref = {}
            for candidato in candidatos:
                status_visivel = canonicalize_candidate_status(candidato.get("status_candidato"))
                if status_visivel in terminal_statuses:
                    continue
                ref = normalize_text(candidato.get("id_processo_ref")) or normalize_text(candidato.get("id_processo"))
                if not ref:
                    continue
                contagem_por_ref[ref] = contagem_por_ref.get(ref, 0) + 1

            for row in rows:
                ref = normalize_text(row.get("id_processo_ref")) or normalize_text(row.get("id_processo"))
                row["candidatos_concorrendo"] = int(contagem_por_ref.get(ref, 0))
                row["quantidade_candidatos"] = row["candidatos_concorrendo"]
            return rows
        finally:
            conn.close()

    def create_process(self, data: dict) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_process_columns(cursor)
            ensure_process_reference_columns(cursor)
            resolved_process_id = generate_unique_process_id(
                cursor,
                data.get("id_processo", ""),
            )
            created_at = normalize_text(data.get("data_criacao")) or datetime.now().isoformat()
            cursor.execute(
                """
                INSERT INTO processos_seletivos
                (
                    id_processo,
                    vaga,
                    quantidade_vagas,
                    vagas_preenchidas,
                    data_encerramento,
                    operacao,
                    trilha,
                    usa_nota_corte,
                    nota_corte,
                    status,
                    data_criacao,
                    link_agendamento
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    resolved_process_id,
                    data.get("vaga", ""),
                    int(data.get("quantidade_vagas", 0) or 0),
                    int(data.get("vagas_preenchidas", 0) or 0),
                    data.get("data_encerramento", ""),
                    data.get("operacao", ""),
                    data.get("trilha", ""),
                    int(data.get("usa_nota_corte", 0) or 0),
                    data.get("nota_corte", None),
                    normalize_process_status(data.get("status", "Aberto")),
                    created_at,
                    data.get("link_agendamento", ""),
                ),
            )
            conn.commit()
            logger.info("Processo '%s' criado.", resolved_process_id)
            return {
                "success": True,
                "id_processo": resolved_process_id,
            }
        finally:
            conn.close()

    def update_process(self, id_processo: str, data: dict) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_process_columns(cursor)
            ensure_process_reference_columns(cursor)
            processo = get_process_row(cursor, id_processo)
            if not processo:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Processo não encontrado.")
            where_clause, params = build_process_where_clause(processo)
            cursor.execute(
                f"""
                UPDATE processos_seletivos
                SET
                    quantidade_vagas = ?,
                    data_encerramento = ?,
                    operacao = ?,
                    trilha = ?,
                    usa_nota_corte = ?,
                    nota_corte = ?,
                    status = ?,
                    link_agendamento = ?,
                    observacoes_publicas_vaga = ?,
                    requisitos_publicos = ?,
                    responsabilidades_publicas = ?
                WHERE {where_clause}
                """,
                (
                    int(data.get("quantidade_vagas", 0) or 0),
                    data.get("data_encerramento", ""),
                    data.get("operacao", ""),
                    data.get("trilha", ""),
                    int(data.get("usa_nota_corte", 0) or 0),
                    data.get("nota_corte", None),
                    normalize_process_status(data.get("status", "Aberto")),
                    data.get("link_agendamento", ""),
                    data.get("observacoes_publicas_vaga")
                    if data.get("observacoes_publicas_vaga") is not None
                    else processo.get("observacoes_publicas_vaga", ""),
                    data.get("requisitos_publicos")
                    if data.get("requisitos_publicos") is not None
                    else processo.get("requisitos_publicos", ""),
                    data.get("responsabilidades_publicas")
                    if data.get("responsabilidades_publicas") is not None
                    else processo.get("responsabilidades_publicas", ""),
                    *params,
                ),
            )
            if normalize_process_status(data.get("status", "Aberto")) == "Encerrado":
                cursor.execute(
                    f"""
                    UPDATE processos_seletivos
                    SET
                        link_publico_ativo = 0,
                        link_publico_desativado_em = GETDATE()
                    WHERE {where_clause}
                    """,
                    *params,
                )
            process_auto_close_if_full(cursor, processo)
            conn.commit()
            logger.info("Processo '%s' atualizado.", processo.get("id_processo_ref") or processo.get("id_processo"))
            return {"success": True}
        finally:
            conn.close()

    def close_process(self, id_processo: str) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_process_reference_columns(cursor)
            processo = get_process_row(cursor, id_processo)
            if not processo:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Processo não encontrado.")
            where_clause, params = build_process_where_clause(processo)
            cursor.execute(
                f"""
                UPDATE processos_seletivos
                SET
                    status = ?,
                    link_publico_ativo = 0,
                    link_publico_desativado_em = GETDATE()
                WHERE {where_clause}
                """,
                ("Encerrado", *params),
            )
            conn.commit()
            logger.info(
                "Processo '%s' encerrado manualmente.",
                processo.get("id_processo_ref") or processo.get("id_processo"),
            )
            return {"success": True}
        finally:
            conn.close()

    def list_process_candidates(self, id_processo: str | None = None) -> list[dict]:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_pipeline_columns(cursor)
            ensure_process_reference_columns(cursor)
            query = """
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
                    data_atualizacao_pipeline,
                    aprovado_em
                FROM candidatos_processos
            """
            params = []
            if normalize_text(id_processo):
                query += " WHERE id_processo = ?"
                params.append(normalize_text(id_processo).split("@@", 1)[0])
            query += " ORDER BY id_registro DESC"

            cursor.execute(query, tuple(params))
            rows = rows_to_dicts(cursor, cursor.fetchall())
            rows = self._hydrate_pipeline_fields(cursor, rows)
            rows = self._enrich_candidate_records(cursor, rows)
            rows = self._attach_process_context(
                cursor,
                rows,
                timestamp_fields=["data_prova", "data_atualizacao_pipeline"],
            )
            rows = [
                item
                for item in rows
                if canonicalize_candidate_status(item.get("status_candidato"))
                != CANDIDATE_STATUS_TALENT_BANK
            ]

            if normalize_text(id_processo):
                filtro_ref = normalize_text(id_processo)
                rows = [
                    item
                    for item in rows
                    if normalize_text(item.get("id_processo_ref")) == filtro_ref
                ]

            return rows
        finally:
            conn.close()

    def create_process_candidate(self, data: dict) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_pipeline_columns(cursor)
            ensure_process_reference_columns(cursor)

            processo = get_process_row(
                cursor,
                data.get("id_processo_ref") or data.get("id_processo", ""),
            )
            if not processo:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Processo não encontrado.")
            if is_process_closed(processo.get("status")):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=build_process_closed_message("adicionar candidato ao processo", processo.get("id_processo")),
                )

            requested_stage = data.get("etapa_pipeline")
            stage = (
                normalize_pipeline_stage(requested_stage)
                if requested_stage
                else infer_pipeline_stage(data.get("status_candidato"), data.get("origem"))
            )
            requested_status = (
                canonicalize_candidate_status(data.get("status_candidato"))
                if normalize_text(data.get("status_candidato"))
                else map_pipeline_stage_to_status(stage)
            )
            id_teste = normalize_text(data.get("id_teste"))
            if not id_teste:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Dados insuficientes para adicionar o candidato ao processo.",
                )
            effective_data_prova = normalize_text(data.get("data_prova")) or datetime.now().isoformat()
            effective_origin = normalize_text(data.get("origem")) or "Prova"
            effective_vaga = normalize_text(data.get("vaga")) or normalize_text(processo.get("vaga"))

            current = None
            provided_id_registro = int(data.get("id_registro") or 0)
            if provided_id_registro > 0:
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
                        data_atualizacao_pipeline,
                        aprovado_em
                    FROM candidatos_processos
                    WHERE id_registro = ?
                    """,
                    (provided_id_registro,),
                )
                current_rows = rows_to_dicts(cursor, cursor.fetchall())
                current = current_rows[0] if current_rows else None

            if not current and id_teste:
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
                        data_atualizacao_pipeline,
                        aprovado_em
                    FROM candidatos_processos
                    WHERE id_teste = ?
                    ORDER BY id_registro DESC
                    """,
                    (id_teste,),
                )
                existing_links = rows_to_dicts(cursor, cursor.fetchall())
                if existing_links:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Este candidato já está vinculado a um processo seletivo.",
                    )
            elif current and id_teste:
                cursor.execute(
                    """
                    SELECT id_registro
                    FROM candidatos_processos
                    WHERE id_teste = ? AND id_registro <> ?
                    """,
                    (id_teste, int(current.get("id_registro") or 0)),
                )
                if cursor.fetchone():
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Este candidato já está vinculado a um processo seletivo.",
                    )

            if current:
                current_status = canonicalize_candidate_status(current.get("status_candidato"))
                if is_terminal_candidate_status(current_status):
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=build_terminal_candidate_locked_message(current_status),
                    )
                effective_status = self._preserve_existing_process_status(
                    current.get("status_candidato"),
                    requested_status,
                )
                effective_stage = (
                    normalize_pipeline_stage(requested_stage)
                    if requested_stage and effective_status == requested_status
                    else infer_pipeline_stage(
                        effective_status,
                        effective_origin or current.get("origem"),
                        current_stage=current.get("etapa_pipeline"),
                    )
                )

                cursor.execute(
                    """
                    UPDATE candidatos_processos
                    SET
                        id_processo = ?,
                        id_processo_ref = ?,
                        id_teste = ?,
                        nome_candidato = ?,
                        vaga = ?,
                        pontuacao_final = ?,
                        data_prova = ?,
                        origem = ?
                    WHERE id_registro = ?
                    """,
                    (
                        processo.get("id_processo", ""),
                        processo.get("id_processo_ref", ""),
                        id_teste or normalize_text(current.get("id_teste")),
                        data.get("nome_candidato", "") or normalize_text(current.get("nome_candidato")),
                        effective_vaga or normalize_text(current.get("vaga")),
                        data.get("pontuacao_final", current.get("pontuacao_final")),
                        effective_data_prova,
                        effective_origin or normalize_text(current.get("origem")),
                        int(current.get("id_registro")),
                    ),
                )

                if (
                    canonicalize_candidate_status(current.get("status_candidato")) != effective_status
                    or normalize_text(current.get("etapa_pipeline")) != effective_stage
                    or normalize_text(current.get("id_processo_ref")) != normalize_text(processo.get("id_processo_ref"))
                ):
                    self._apply_candidate_status_update(
                        cursor,
                        current_row={
                            **current,
                            "id_processo": processo.get("id_processo", ""),
                            "id_processo_ref": processo.get("id_processo_ref", ""),
                            "id_teste": id_teste or normalize_text(current.get("id_teste")),
                            "nome_candidato": data.get("nome_candidato", "") or normalize_text(current.get("nome_candidato")),
                            "vaga": effective_vaga or normalize_text(current.get("vaga")),
                            "pontuacao_final": data.get("pontuacao_final", current.get("pontuacao_final")),
                            "data_prova": effective_data_prova,
                            "origem": effective_origin or normalize_text(current.get("origem")),
                        },
                        new_status=effective_status,
                        new_stage=effective_stage,
                        data_movimentacao=effective_data_prova,
                    )

                self._upsert_candidate_profile(
                    cursor,
                    id_teste=id_teste or current.get("id_teste", ""),
                    nome_candidato=data.get("nome_candidato", ""),
                )
                conn.commit()
                logger.info(
                    "Candidato '%s' atualizado no processo '%s'.",
                    data.get("nome_candidato", ""),
                    processo.get("id_processo_ref") or processo.get("id_processo", ""),
                )
                return {"success": True, "id_registro": int(current.get("id_registro") or 0)}

            id_registro = insert_candidate_process_record(
                cursor,
                processo,
                {
                    "id_teste": id_teste,
                    "nome_candidato": data.get("nome_candidato", ""),
                    "vaga": effective_vaga,
                    "status_candidato": requested_status,
                    "pontuacao_final": data.get("pontuacao_final", ""),
                    "data_prova": effective_data_prova,
                    "origem": effective_origin,
                    "etapa_pipeline": stage,
                    "data_atualizacao_pipeline": datetime.now(),
                },
            )
            self._upsert_candidate_profile(
                cursor,
                id_teste=id_teste,
                nome_candidato=data.get("nome_candidato", ""),
            )

            if requested_status != CANDIDATE_STATUS_ANALYSIS or stage != "Triagem":
                self._apply_candidate_status_update(
                    cursor,
                    current_row={
                        "id_registro": id_registro,
                        "id_processo": processo.get("id_processo", ""),
                        "id_processo_ref": processo.get("id_processo_ref", ""),
                        "id_teste": id_teste,
                        "nome_candidato": data.get("nome_candidato", ""),
                        "vaga": effective_vaga,
                        "status_candidato": CANDIDATE_STATUS_ANALYSIS,
                        "pontuacao_final": data.get("pontuacao_final", ""),
                        "data_prova": effective_data_prova,
                        "origem": effective_origin,
                        "etapa_pipeline": "Triagem",
                        "data_atualizacao_pipeline": effective_data_prova,
                    },
                    new_status=requested_status,
                    new_stage=stage,
                    data_movimentacao=effective_data_prova,
                )

            conn.commit()
            logger.info(
                "Candidato '%s' vinculado ao processo '%s'.",
                data.get("nome_candidato", ""),
                processo.get("id_processo_ref") or processo.get("id_processo", ""),
            )
            return {"success": True, "id_registro": id_registro}
        finally:
            conn.close()

    def update_process_candidate_status(self, id_registro: int, data: dict) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_pipeline_columns(cursor)
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
                    data_atualizacao_pipeline,
                    aprovado_em
                FROM candidatos_processos
                WHERE id_registro = ?
                """,
                (id_registro,),
            )
            current_rows = rows_to_dicts(cursor, cursor.fetchall())
            if not current_rows:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidato do processo não encontrado.")
            current = current_rows[0]
            current_status = canonicalize_candidate_status(current.get("status_candidato"))
            if is_terminal_candidate_status(current_status):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=build_terminal_candidate_locked_message(current_status),
                )

            requested_status = normalize_text(data.get("status_candidato"))
            current_stage = current.get("etapa_pipeline")
            new_stage = (
                normalize_pipeline_stage(data.get("etapa_pipeline"))
                if data.get("etapa_pipeline")
                else infer_pipeline_stage(requested_status, current.get("origem"), current_stage=current_stage)
            )
            new_status = (
                canonicalize_candidate_status(requested_status)
                if requested_status
                else map_pipeline_stage_to_status(new_stage, current.get("status_candidato"))
            )

            self._apply_candidate_status_update(
                cursor,
                current_row=current,
                new_status=new_status,
                new_stage=new_stage,
                data_movimentacao=data.get("data_movimentacao"),
                approval_payload=data,
            )

            conn.commit()
            logger.info("Status do candidato %s atualizado para '%s'.", id_registro, new_status)
            return {"success": True}
        finally:
            conn.close()

    def get_process_details(self, id_processo: str) -> dict:
        def operation() -> dict:
            conn = self._connect()
            try:
                cursor = conn.cursor()
                ensure_pipeline_columns(cursor)
                ensure_process_reference_columns(cursor)

                processo = get_process_row(cursor, id_processo)
                if not processo:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Processo não encontrado.")

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
                        data_atualizacao_pipeline,
                        aprovado_em
                    FROM candidatos_processos
                    WHERE id_processo = ?
                    ORDER BY id_registro DESC
                    """,
                    (processo.get("id_processo"),),
                )
                candidatos = rows_to_dicts(cursor, cursor.fetchall())
                candidatos = self._hydrate_pipeline_fields(cursor, candidatos)
                candidatos = self._enrich_candidate_records(cursor, candidatos)
                candidatos = self._attach_process_context(
                    cursor,
                    candidatos,
                    timestamp_fields=["data_prova", "data_atualizacao_pipeline"],
                )
                candidatos = [
                    item
                    for item in candidatos
                    if normalize_text(item.get("id_processo_ref"))
                    == normalize_text(processo.get("id_processo_ref"))
                ]
                cursor.execute(
                    """
                    SELECT
                        id_pre_analise,
                        email,
                        score_final,
                        classificacao,
                        classificacao_slug,
                        problemas
                    FROM cv_pre_analises
                    WHERE id_processo = ? AND id_processo_ref = ?
                    """,
                    (processo.get("id_processo"), processo.get("id_processo_ref", "")),
                )
                analises_cv = rows_to_dicts(cursor, cursor.fetchall())
                analises_por_email = {
                    normalize_compare_text(item.get("email")): item
                    for item in analises_cv
                    if normalize_compare_text(item.get("email"))
                }
                for candidato in candidatos:
                    analise = analises_por_email.get(normalize_compare_text(candidato.get("email")))
                    if not analise:
                        continue
                    candidato["cv_id_pre_analise"] = analise.get("id_pre_analise")
                    candidato["cv_score_final"] = analise.get("score_final")
                    candidato["cv_classificacao"] = analise.get("classificacao")
                    candidato["cv_classificacao_slug"] = analise.get("classificacao_slug")
                    candidato["cv_problemas"] = analise.get("problemas")

                status_fluxo = [
                    get_candidate_visible_status(
                        item.get("status_candidato"),
                        item.get("status_entrevista"),
                    )
                    for item in candidatos
                ]
                candidatos_visiveis = [
                    item
                    for item, status_item in zip(candidatos, status_fluxo)
                    if status_item != CANDIDATE_STATUS_TALENT_BANK
                ]
                candidatos_ativos = [
                    item
                    for item, status_item in zip(candidatos, status_fluxo)
                    if status_item != CANDIDATE_STATUS_TALENT_BANK
                    and is_active_candidate_status(status_item)
                ]
                candidatos_aprovados = [
                    item
                    for item, status_item in zip(candidatos, status_fluxo)
                    if status_item == CANDIDATE_STATUS_APPROVED
                ]
                candidatos_finalizados = [
                    item
                    for item, status_item in zip(candidatos, status_fluxo)
                    if status_item != CANDIDATE_STATUS_TALENT_BANK
                    and status_item != CANDIDATE_STATUS_APPROVED
                    and not is_active_candidate_status(status_item)
                ]
                status_fluxo_visivel = [
                    status_item
                    for status_item in status_fluxo
                    if status_item != CANDIDATE_STATUS_TALENT_BANK
                ]

                resumo = {
                    "total": len(candidatos_visiveis),
                    "analise": sum(1 for status_item in status_fluxo_visivel if status_item == CANDIDATE_STATUS_ANALYSIS),
                    "qualificados": sum(1 for status_item in status_fluxo_visivel if status_item == CANDIDATE_STATUS_QUALIFIED),
                    "entrevistas": sum(
                        1
                        for status_item in status_fluxo_visivel
                        if status_item in {
                            CANDIDATE_STATUS_SCHEDULED,
                            CANDIDATE_STATUS_CONFIRMED,
                            CANDIDATE_STATUS_ATTENDED,
                            CANDIDATE_STATUS_MISSED,
                        }
                    ),
                    "aprovados": sum(1 for status_item in status_fluxo_visivel if status_item == CANDIDATE_STATUS_APPROVED),
                    "eliminados": sum(1 for status_item in status_fluxo_visivel if status_item in {CANDIDATE_STATUS_ELIMINATED, CANDIDATE_STATUS_WITHDREW}),
                    "banco": sum(1 for status_item in status_fluxo if status_item == CANDIDATE_STATUS_TALENT_BANK),
                }
                processo["public_candidate_base_url"] = normalize_text(
                    getattr(self.settings, "public_candidate_base_url", ""),
                )
                processo["public_candidate_base_url_configured"] = bool(
                    processo["public_candidate_base_url"],
                )

                return {
                    "processo": processo,
                    "resumo": resumo,
                    "candidatos": candidatos_visiveis,
                    "candidatos_ativos": candidatos_ativos,
                    "candidatos_aprovados": candidatos_aprovados,
                    "candidatos_finalizados": candidatos_finalizados,
                }
            finally:
                conn.close()

        return self._run_with_deadlock_retry(
            f"carregar detalhes do processo {id_processo}",
            operation,
            retries=1,
            final_message="Não foi possível carregar os detalhes do processo agora por conta de concorrência no banco. Tente novamente em instantes.",
        )
