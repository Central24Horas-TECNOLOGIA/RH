from __future__ import annotations

import logging
from datetime import datetime

from fastapi import HTTPException, status

from ..services.helpers import normalize_compare_text, normalize_text, rows_to_dicts
from ..services.pipeline import infer_pipeline_stage, map_pipeline_stage_to_status, normalize_pipeline_stage
from .bootstrap import (
    ensure_pipeline_columns,
    ensure_process_columns,
    get_next_id_registro,
    get_process_row,
    process_auto_close_if_full,
)


logger = logging.getLogger(__name__)


class ProcessRepositoryMixin:
    def list_processes(self) -> list[dict]:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT
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
                FROM processos_seletivos
                """
            )
            return rows_to_dicts(cursor, cursor.fetchall())
        finally:
            conn.close()

    def create_process(self, data: dict) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_process_columns(cursor)
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
                    data.get("id_processo", ""),
                    data.get("vaga", ""),
                    int(data.get("quantidade_vagas", 0) or 0),
                    int(data.get("vagas_preenchidas", 0) or 0),
                    data.get("data_encerramento", ""),
                    data.get("operacao", ""),
                    data.get("trilha", ""),
                    int(data.get("usa_nota_corte", 0) or 0),
                    data.get("nota_corte", None),
                    data.get("status", "Aberto"),
                    data.get("data_criacao", ""),
                    data.get("link_agendamento", ""),
                ),
            )
            conn.commit()
            logger.info("Processo '%s' criado.", data.get("id_processo", ""))
            return {"success": True}
        finally:
            conn.close()

    def update_process(self, id_processo: str, data: dict) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_process_columns(cursor)
            cursor.execute(
                """
                UPDATE processos_seletivos
                SET
                    quantidade_vagas = ?,
                    data_encerramento = ?,
                    operacao = ?,
                    trilha = ?,
                    usa_nota_corte = ?,
                    nota_corte = ?,
                    status = ?,
                    link_agendamento = ?
                WHERE id_processo = ?
                """,
                (
                    int(data.get("quantidade_vagas", 0) or 0),
                    data.get("data_encerramento", ""),
                    data.get("operacao", ""),
                    data.get("trilha", ""),
                    int(data.get("usa_nota_corte", 0) or 0),
                    data.get("nota_corte", None),
                    data.get("status", "Aberto"),
                    data.get("link_agendamento", ""),
                    id_processo,
                ),
            )
            process_auto_close_if_full(cursor, id_processo)
            conn.commit()
            logger.info("Processo '%s' atualizado.", id_processo)
            return {"success": True}
        finally:
            conn.close()

    def close_process(self, id_processo: str) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE processos_seletivos
                SET status = ?
                WHERE id_processo = ?
                """,
                ("Encerrado", id_processo),
            )
            conn.commit()
            logger.info("Processo '%s' encerrado manualmente.", id_processo)
            return {"success": True}
        finally:
            conn.close()

    def list_process_candidates(self, id_processo: str | None = None) -> list[dict]:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            query = """
                SELECT
                    id_registro,
                    id_processo,
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
            """
            params = []
            if normalize_text(id_processo):
                query += " WHERE id_processo = ?"
                params.append(id_processo)
            query += " ORDER BY id_registro DESC"

            cursor.execute(query, tuple(params))
            rows = rows_to_dicts(cursor, cursor.fetchall())
            rows = self._hydrate_pipeline_fields(cursor, rows)
            return self._enrich_candidate_records(cursor, rows)
        finally:
            conn.close()

    def create_process_candidate(self, data: dict) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_pipeline_columns(cursor)

            id_registro = get_next_id_registro(cursor)
            requested_stage = data.get("etapa_pipeline")
            stage = (
                normalize_pipeline_stage(requested_stage)
                if requested_stage
                else infer_pipeline_stage(data.get("status_candidato"), data.get("origem"))
            )
            status_candidato = normalize_text(data.get("status_candidato")) or map_pipeline_stage_to_status(stage)

            cursor.execute(
                """
                INSERT INTO candidatos_processos
                (
                    id_registro,
                    id_processo,
                    id_teste,
                    nome_candidato,
                    vaga,
                    status_candidato,
                    pontuacao_final,
                    data_prova,
                    origem,
                    etapa_pipeline,
                    data_atualizacao_pipeline
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    id_registro,
                    data.get("id_processo", ""),
                    data.get("id_teste", ""),
                    data.get("nome_candidato", ""),
                    data.get("vaga", ""),
                    status_candidato,
                    data.get("pontuacao_final", ""),
                    data.get("data_prova", ""),
                    data.get("origem", "Prova"),
                    stage,
                    datetime.now(),
                ),
            )
            self._upsert_candidate_profile(
                cursor,
                id_teste=data.get("id_teste", ""),
                nome_candidato=data.get("nome_candidato", ""),
            )
            conn.commit()
            logger.info("Candidato '%s' vinculado ao processo '%s'.", data.get("nome_candidato", ""), data.get("id_processo", ""))
            return {"success": True}
        finally:
            conn.close()

    def update_process_candidate_status(self, id_registro: int, data: dict) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_pipeline_columns(cursor)

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
                (id_registro,),
            )
            current = cursor.fetchone()
            if not current:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidato do processo nao encontrado.")

            requested_status = normalize_text(data.get("status_candidato"))
            current_stage = current[8]
            new_stage = (
                normalize_pipeline_stage(data.get("etapa_pipeline"))
                if data.get("etapa_pipeline")
                else infer_pipeline_stage(requested_status, current[7], current_stage=current_stage)
            )
            new_status = requested_status or map_pipeline_stage_to_status(new_stage)

            self._apply_candidate_status_update(
                cursor,
                current_row=current,
                new_status=new_status,
                new_stage=new_stage,
                data_movimentacao=data.get("data_movimentacao"),
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

                processo = get_process_row(cursor, id_processo)
                if not processo:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Processo nao encontrado.")

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
                        data_prova,
                        origem,
                        etapa_pipeline,
                        data_atualizacao_pipeline
                    FROM candidatos_processos
                    WHERE id_processo = ?
                    ORDER BY id_registro DESC
                    """,
                    (id_processo,),
                )
                candidatos = rows_to_dicts(cursor, cursor.fetchall())
                candidatos = self._hydrate_pipeline_fields(cursor, candidatos)
                candidatos = self._enrich_candidate_records(cursor, candidatos)

                resumo = {
                    "total": len(candidatos),
                    "aprovados": sum(1 for item in candidatos if normalize_compare_text(item.get("status_candidato")) == "aprovado"),
                    "eliminados": sum(
                        1
                        for item in candidatos
                        if "eliminado" in normalize_compare_text(item.get("status_candidato"))
                        or normalize_compare_text(item.get("status_candidato")) == "reprovado"
                    ),
                    "banco": sum(1 for item in candidatos if normalize_compare_text(item.get("status_candidato")) == "banco de talentos"),
                    "analise": sum(1 for item in candidatos if normalize_compare_text(item.get("status_candidato")) == "em analise"),
                }

                return {"processo": processo, "resumo": resumo, "candidatos": candidatos}
            finally:
                conn.close()

        return self._run_with_deadlock_retry(
            f"carregar detalhes do processo {id_processo}",
            operation,
            retries=1,
            final_message="Nao foi possivel carregar os detalhes do processo agora por conta de concorrencia no banco. Tente novamente em instantes.",
        )
