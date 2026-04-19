from __future__ import annotations

import logging
from datetime import datetime

from fastapi import HTTPException, status

from ..services.helpers import normalize_text, rows_to_dicts
from ..services.pipeline import map_pipeline_stage_to_status, normalize_pipeline_stage
from .bootstrap import ensure_interviews_table, ensure_pipeline_columns, get_next_id_registro, get_process_row


logger = logging.getLogger(__name__)


class PipelineRepositoryMixin:
    def list_pipeline_cards(self, id_processo: str = "", search: str = "") -> list[dict]:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_pipeline_columns(cursor)

            query = """
                SELECT
                    c.id_registro,
                    c.id_processo,
                    c.id_teste,
                    c.nome_candidato,
                    c.vaga,
                    c.status_candidato,
                    c.pontuacao_final,
                    c.data_prova,
                    c.origem,
                    c.etapa_pipeline,
                    c.data_atualizacao_pipeline,
                    p.status AS status_processo
                FROM candidatos_processos c
                LEFT JOIN processos_seletivos p
                    ON p.id_processo = c.id_processo
                WHERE ISNULL(c.id_processo, '') <> ''
            """
            params = []

            if normalize_text(id_processo):
                query += " AND c.id_processo = ?"
                params.append(id_processo)
            if normalize_text(search):
                query += " AND (c.nome_candidato LIKE ? OR c.vaga LIKE ? OR c.id_processo LIKE ?)"
                filtro = f"%{search.strip()}%"
                params.extend([filtro, filtro, filtro])

            query += " ORDER BY c.id_processo ASC, c.id_registro DESC"
            cursor.execute(query, tuple(params))
            rows = rows_to_dicts(cursor, cursor.fetchall())
            rows = self._hydrate_pipeline_fields(cursor, rows)
            return self._enrich_candidate_records(cursor, rows)
        finally:
            conn.close()

    def create_pipeline_candidate(self, data: dict) -> dict:
        id_processo = normalize_text(data.get("id_processo"))
        if not id_processo:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Processo obrigatorio para criar card no pipeline.")

        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_pipeline_columns(cursor)
            processo = get_process_row(cursor, id_processo)
            if not processo:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Processo nao encontrado.")

            id_registro = get_next_id_registro(cursor)
            etapa_pipeline = normalize_pipeline_stage(data.get("etapa_pipeline"))
            status_candidato = map_pipeline_stage_to_status(etapa_pipeline)
            id_teste = normalize_text(data.get("id_teste")) or datetime.now().strftime("PIPE-%Y%m%d-%H%M%S%f")
            data_prova = normalize_text(data.get("data_prova")) or datetime.now().isoformat()
            vaga = normalize_text(data.get("vaga")) or normalize_text(processo.get("vaga"))

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
                    id_processo,
                    id_teste,
                    data.get("nome_candidato", ""),
                    vaga,
                    status_candidato,
                    data.get("pontuacao_final", ""),
                    data_prova,
                    data.get("origem", "Pipeline manual"),
                    etapa_pipeline,
                    datetime.now(),
                ),
            )
            self._upsert_candidate_profile(
                cursor,
                id_teste=id_teste,
                nome_candidato=data.get("nome_candidato", ""),
            )
            conn.commit()
            logger.info("Card de pipeline criado para '%s' no processo '%s'.", data.get("nome_candidato", ""), id_processo)
            return {"success": True, "id_registro": id_registro}
        finally:
            conn.close()

    def move_pipeline_card(self, id_registro: int, data: dict) -> dict:
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
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card do pipeline nao encontrado.")

            new_stage = normalize_pipeline_stage(data.get("etapa_pipeline"))
            new_status = map_pipeline_stage_to_status(new_stage)

            self._apply_candidate_status_update(
                cursor,
                current_row=current,
                new_status=new_status,
                new_stage=new_stage,
                data_movimentacao=data.get("data_movimentacao"),
            )
            conn.commit()
            logger.info("Card %s movido para a etapa '%s'.", id_registro, new_stage)
            return {"success": True}
        finally:
            conn.close()

    def delete_pipeline_card(self, id_registro: int) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_interviews_table(cursor)
            cursor.execute(
                """
                SELECT id_processo, id_teste, status_candidato
                FROM candidatos_processos
                WHERE id_registro = ?
                """,
                (id_registro,),
            )
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card do pipeline nao encontrado.")

            id_processo = normalize_text(row[0])
            id_teste = normalize_text(row[1])
            status_candidato = normalize_text(row[2]).casefold()

            if id_processo and status_candidato == "aprovado":
                cursor.execute(
                    """
                    UPDATE processos_seletivos
                    SET vagas_preenchidas = CASE
                        WHEN ISNULL(vagas_preenchidas, 0) > 0 THEN vagas_preenchidas - 1
                        ELSE 0
                    END
                    WHERE id_processo = ?
                    """,
                    (id_processo,),
                )

            cursor.execute("DELETE FROM entrevistas_agendadas WHERE id_registro = ? OR id_teste = ?", (id_registro, id_teste))
            cursor.execute("DELETE FROM banco_talentos WHERE id_teste = ?", (id_teste,))
            cursor.execute("DELETE FROM candidatos_processos WHERE id_registro = ?", (id_registro,))
            conn.commit()
            logger.info("Card %s removido do pipeline e dos vinculos operacionais.", id_registro)
            return {"success": True}
        finally:
            conn.close()
