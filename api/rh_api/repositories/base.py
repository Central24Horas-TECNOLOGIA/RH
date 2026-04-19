from __future__ import annotations

import json
import logging
import time
from datetime import datetime

import pyodbc
from fastapi import HTTPException, status

from ..config import Settings
from ..db import get_connection
from ..services.helpers import (
    normalize_compare_text,
    normalize_string_list,
    normalize_text,
    rows_to_dicts,
    safe_json_loads,
)
from ..services.pipeline import infer_pipeline_stage
from .bootstrap import (
    describe_database_error,
    ensure_candidate_metadata_table,
    get_gabaritos_payload_column,
    is_deadlock_error,
)


class BaseRepository:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.logger = logging.getLogger(self.__class__.__name__)

    def _connect(self):
        return get_connection(self.settings)

    def _run_with_deadlock_retry(
        self,
        action: str,
        operation,
        *,
        retries: int = 1,
        base_delay_seconds: float = 0.2,
        final_message: str | None = None,
    ):
        total_attempts = max(1, retries + 1)

        for attempt in range(1, total_attempts + 1):
            try:
                return operation()
            except pyodbc.Error as exc:
                if not is_deadlock_error(exc):
                    raise

                if attempt >= total_attempts:
                    self.logger.error(
                        "Deadlock persistente ao %s apos %s tentativa(s): %s",
                        action,
                        attempt,
                        describe_database_error(exc),
                    )
                    raise HTTPException(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        detail=final_message
                        or "O banco de dados ficou temporariamente indisponivel por conflito de concorrencia. Tente novamente em instantes.",
                    ) from exc

                wait_seconds = base_delay_seconds * attempt
                self.logger.warning(
                    "Deadlock ao %s. Tentativa %s/%s em %.2fs. Detalhes: %s",
                    action,
                    attempt,
                    total_attempts,
                    wait_seconds,
                    describe_database_error(exc),
                )
                time.sleep(wait_seconds)

    def _serialize_candidate_profile(self, row: dict | None = None) -> dict:
        safe_row = row or {}
        return {
            "nome_candidato": normalize_text(safe_row.get("nome_candidato")),
            "habilidades": normalize_string_list(safe_json_loads(safe_row.get("habilidades_json"), [])),
            "tags": normalize_string_list(safe_json_loads(safe_row.get("tags_json"), [])),
            "observacao_rh": normalize_text(safe_row.get("observacao_rh")),
        }

    def _get_candidate_profile_map(self, cursor) -> dict[str, dict]:
        cursor.execute(
            """
            SELECT id_teste, nome_candidato, habilidades_json, tags_json, observacao_rh
            FROM candidatos_metadata
            """
        )
        rows = rows_to_dicts(cursor, cursor.fetchall())
        result = {}
        for row in rows:
            id_teste = normalize_text(row.get("id_teste"))
            if not id_teste:
                continue
            result[id_teste] = self._serialize_candidate_profile(row)
        return result

    def _get_latest_interview_map(self, cursor) -> dict[str, dict]:
        cursor.execute(
            """
            WITH entrevistas_ordenadas AS (
                SELECT
                    id_teste,
                    id_registro,
                    id_entrevista,
                    id_processo,
                    data_entrevista,
                    status_entrevista,
                    link_agendamento,
                    observacoes_rh,
                    mensagem_base,
                    ROW_NUMBER() OVER (
                        PARTITION BY id_teste
                        ORDER BY data_entrevista DESC, id_entrevista DESC
                    ) AS ordem
                FROM entrevistas_agendadas
                WHERE ISNULL(id_teste, '') <> ''
            )
            SELECT
                id_teste,
                id_registro,
                id_entrevista,
                id_processo,
                data_entrevista,
                status_entrevista,
                link_agendamento,
                observacoes_rh,
                mensagem_base
            FROM entrevistas_ordenadas
            WHERE ordem = 1
            """
        )
        rows = rows_to_dicts(cursor, cursor.fetchall())
        return {
            normalize_text(item.get("id_teste")): item
            for item in rows
            if normalize_text(item.get("id_teste"))
        }

    def _enrich_candidate_records(self, cursor, candidates: list[dict]) -> list[dict]:
        profile_map = self._get_candidate_profile_map(cursor)
        interview_map = self._get_latest_interview_map(cursor)

        for candidate in candidates:
            id_teste = normalize_text(candidate.get("id_teste"))
            profile = profile_map.get(id_teste, {})
            latest_interview = interview_map.get(id_teste, {})

            candidate["tags"] = profile.get("tags", [])
            candidate["habilidades"] = profile.get("habilidades", [])
            candidate["observacao_rh"] = profile.get("observacao_rh", "")
            candidate["status_entrevista"] = normalize_text(latest_interview.get("status_entrevista"))
            candidate["data_entrevista"] = latest_interview.get("data_entrevista")
            candidate["link_entrevista"] = normalize_text(latest_interview.get("link_agendamento"))
            candidate["observacoes_entrevista"] = normalize_text(latest_interview.get("observacoes_rh"))
            candidate["mensagem_entrevista"] = normalize_text(latest_interview.get("mensagem_base"))
            candidate["id_entrevista"] = latest_interview.get("id_entrevista")

        return candidates

    def _upsert_candidate_profile(
        self,
        cursor,
        *,
        id_teste: str,
        nome_candidato: str = "",
        habilidades: list[str] | None = None,
        tags: list[str] | None = None,
        observacao_rh: str | None = None,
    ) -> None:
        safe_id_teste = normalize_text(id_teste)
        if not safe_id_teste:
            return

        ensure_candidate_metadata_table(cursor)
        cursor.execute(
            """
            SELECT nome_candidato, habilidades_json, tags_json, observacao_rh
            FROM candidatos_metadata
            WHERE id_teste = ?
            """,
            (safe_id_teste,),
        )
        existing = cursor.fetchone()

        existing_profile = (
            self._serialize_candidate_profile(
                {
                    "nome_candidato": existing[0],
                    "habilidades_json": existing[1],
                    "tags_json": existing[2],
                    "observacao_rh": existing[3],
                }
            )
            if existing
            else {"nome_candidato": "", "habilidades": [], "tags": [], "observacao_rh": ""}
        )

        merged_name = normalize_text(nome_candidato) or existing_profile.get("nome_candidato", "")
        merged_skills = normalize_string_list(habilidades if habilidades is not None else existing_profile.get("habilidades", []))
        merged_tags = normalize_string_list(tags if tags is not None else existing_profile.get("tags", []))
        merged_observation = (
            normalize_text(observacao_rh)
            if observacao_rh is not None
            else existing_profile.get("observacao_rh", "")
        )

        if existing:
            cursor.execute(
                """
                UPDATE candidatos_metadata
                SET
                    nome_candidato = ?,
                    habilidades_json = ?,
                    tags_json = ?,
                    observacao_rh = ?,
                    atualizado_em = GETDATE()
                WHERE id_teste = ?
                """,
                (
                    merged_name,
                    json.dumps(merged_skills, ensure_ascii=False),
                    json.dumps(merged_tags, ensure_ascii=False),
                    merged_observation,
                    safe_id_teste,
                ),
            )
        else:
            cursor.execute(
                """
                INSERT INTO candidatos_metadata
                (
                    id_teste,
                    nome_candidato,
                    habilidades_json,
                    tags_json,
                    observacao_rh
                )
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    safe_id_teste,
                    merged_name,
                    json.dumps(merged_skills, ensure_ascii=False),
                    json.dumps(merged_tags, ensure_ascii=False),
                    merged_observation,
                ),
            )

    def _hydrate_pipeline_fields(self, cursor, candidates: list[dict]) -> list[dict]:
        mutated = False
        now = datetime.now()

        for candidate in candidates:
            inferred_stage = infer_pipeline_stage(
                candidate.get("status_candidato"),
                candidate.get("origem"),
                candidate.get("etapa_pipeline"),
            )
            current_stage = normalize_text(candidate.get("etapa_pipeline"))
            if current_stage != inferred_stage:
                cursor.execute(
                    """
                    UPDATE candidatos_processos
                    SET etapa_pipeline = ?, data_atualizacao_pipeline = ?
                    WHERE id_registro = ?
                    """,
                    (inferred_stage, now, candidate.get("id_registro")),
                )
                candidate["etapa_pipeline"] = inferred_stage
                candidate["data_atualizacao_pipeline"] = now.isoformat()
                mutated = True
            else:
                candidate["etapa_pipeline"] = inferred_stage

        if mutated:
            cursor.connection.commit()

        return candidates

    def _get_process_map(self, cursor) -> dict[str, dict]:
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
                link_agendamento
            FROM processos_seletivos
            """
        )
        rows = rows_to_dicts(cursor, cursor.fetchall())
        return {normalize_text(item.get("id_processo")): item for item in rows}

    def _get_process_candidate_map(self, cursor) -> dict[str, dict]:
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
            """
        )
        rows = rows_to_dicts(cursor, cursor.fetchall())
        rows = self._hydrate_pipeline_fields(cursor, rows)
        rows = self._enrich_candidate_records(cursor, rows)

        result = {}
        for item in rows:
            id_teste = normalize_text(item.get("id_teste"))
            if id_teste:
                result[id_teste] = item
        return result

    def _get_answer_files_map(self, cursor) -> dict[str, dict]:
        payload_column = get_gabaritos_payload_column(cursor)
        cursor.execute(f"SELECT record_id, {payload_column} FROM gabaritos")
        rows = cursor.fetchall()
        result = {}
        for row in rows:
            record_id = normalize_text(row[0])
            if record_id:
                result[record_id] = safe_json_loads(row[1], {})
        return result

    def _apply_candidate_status_update(
        self,
        cursor,
        *,
        current_row,
        new_status: str,
        new_stage: str,
        data_movimentacao: str | None = None,
    ) -> None:
        id_registro = int(current_row[0])
        id_processo = normalize_text(current_row[1])
        id_teste = normalize_text(current_row[2])
        nome_candidato = normalize_text(current_row[3])
        vaga = normalize_text(current_row[4])
        old_status = normalize_text(current_row[5])
        pontuacao_final = current_row[6]
        origem = normalize_text(current_row[7])

        if not id_processo:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Processo do candidato nao encontrado.")

        data_pipeline = datetime.fromisoformat(data_movimentacao) if data_movimentacao else datetime.now()

        cursor.execute(
            """
            UPDATE candidatos_processos
            SET status_candidato = ?, etapa_pipeline = ?, data_atualizacao_pipeline = ?
            WHERE id_registro = ?
            """,
            (new_status, new_stage, data_pipeline, id_registro),
        )

        cursor.execute(
            """
            SELECT quantidade_vagas, vagas_preenchidas, status
            FROM processos_seletivos
            WHERE id_processo = ?
            """,
            (id_processo,),
        )
        process_row = cursor.fetchone()
        if not process_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Processo seletivo nao encontrado.")

        quantidade_vagas = int(process_row[0] or 0)
        vagas_preenchidas = int(process_row[1] or 0)
        status_processo = normalize_text(process_row[2])

        old_status_normalized = normalize_compare_text(old_status)
        new_status_normalized = normalize_compare_text(new_status)

        if old_status_normalized != "aprovado" and new_status_normalized == "aprovado":
            vagas_preenchidas += 1
        elif old_status_normalized == "aprovado" and new_status_normalized != "aprovado":
            vagas_preenchidas = max(0, vagas_preenchidas - 1)

        cursor.execute(
            """
            UPDATE processos_seletivos
            SET vagas_preenchidas = ?
            WHERE id_processo = ?
            """,
            (vagas_preenchidas, id_processo),
        )

        if status_processo != "Encerrado" and quantidade_vagas > 0 and vagas_preenchidas >= quantidade_vagas:
            cursor.execute(
                """
                UPDATE processos_seletivos
                SET status = ?
                WHERE id_processo = ?
                """,
                ("Encerrado", id_processo),
            )

        if new_status_normalized != "banco de talentos":
            cursor.execute(
                """
                DELETE FROM banco_talentos
                WHERE id_teste = ?
                """,
                (id_teste,),
            )

        if new_status_normalized == "banco de talentos":
            cursor.execute(
                """
                SELECT COUNT(*)
                FROM banco_talentos
                WHERE id_teste = ?
                """,
                (id_teste,),
            )
            already_exists = int(cursor.fetchone()[0] or 0)

            if not already_exists:
                cursor.execute(
                    """
                    INSERT INTO banco_talentos
                    (
                        id_processo,
                        id_teste,
                        nome_candidato,
                        vaga,
                        pontuacao_final,
                        data_movimentacao,
                        origem
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        id_processo,
                        id_teste,
                        nome_candidato,
                        vaga,
                        pontuacao_final,
                        data_movimentacao or datetime.now().isoformat(),
                        origem or "Prova",
                    ),
                )
