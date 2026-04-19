from __future__ import annotations

import base64
import json
import logging
import math
import threading
import time
from datetime import datetime

import pyodbc
from fastapi import HTTPException, UploadFile, status

from ..config import Settings
from ..db import get_connection
from ..services.analytics import build_analysis_from_payload
from ..services.cv import (
    extract_candidate_name,
    extract_education_strength,
    extract_email,
    extract_experience_strength,
    extract_keywords,
    extract_phone,
    extract_text_from_uploaded_file,
    extract_whatsapp,
    normalize_cv_text,
    score_cv_for_role,
    serialize_cv_problems,
)
from ..services.helpers import (
    normalize_compare_text,
    normalize_string_list,
    normalize_text,
    parse_float_br,
    rows_to_dicts,
    safe_json_loads,
)
from ..services.interviews import build_interview_message, normalize_interview_status
from ..services.pipeline import infer_pipeline_stage, map_pipeline_stage_to_status, normalize_pipeline_stage


logger = logging.getLogger(__name__)
_SCHEMA_BOOTSTRAP_LOCK = threading.Lock()
_SCHEMA_BOOTSTRAPPED = False


def ensure_cv_pre_analises_table(cursor) -> None:
    cursor.execute(
        """
        IF OBJECT_ID('dbo.cv_pre_analises', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.cv_pre_analises (
                id_pre_analise INT IDENTITY(1,1) PRIMARY KEY,
                id_processo NVARCHAR(60) NOT NULL,
                nome_candidato NVARCHAR(255) NULL,
                email NVARCHAR(255) NULL,
                telefone NVARCHAR(50) NULL,
                whatsapp NVARCHAR(50) NULL,
                palavras_chave NVARCHAR(MAX) NULL,
                score_final DECIMAL(5,2) NULL,
                classificacao NVARCHAR(50) NULL,
                classificacao_slug NVARCHAR(50) NULL,
                problemas NVARCHAR(MAX) NULL,
                texto_extraido NVARCHAR(MAX) NULL,
                nome_arquivo NVARCHAR(255) NULL,
                mime_type NVARCHAR(120) NULL,
                arquivo_original_base64 NVARCHAR(MAX) NULL,
                ja_adicionado_ao_processo BIT NOT NULL DEFAULT 0,
                criado_em DATETIME NOT NULL DEFAULT GETDATE()
            )
        END
        """
    )


def ensure_pipeline_columns(cursor) -> None:
    cursor.execute(
        """
        IF COL_LENGTH('dbo.candidatos_processos', 'etapa_pipeline') IS NULL
        BEGIN
            ALTER TABLE dbo.candidatos_processos
            ADD etapa_pipeline NVARCHAR(30) NULL
        END
        """
    )
    cursor.execute(
        """
        IF COL_LENGTH('dbo.candidatos_processos', 'data_atualizacao_pipeline') IS NULL
        BEGIN
            ALTER TABLE dbo.candidatos_processos
            ADD data_atualizacao_pipeline DATETIME NULL
        END
        """
    )


def ensure_process_columns(cursor) -> None:
    cursor.execute(
        """
        IF COL_LENGTH('dbo.processos_seletivos', 'link_agendamento') IS NULL
        BEGIN
            ALTER TABLE dbo.processos_seletivos
            ADD link_agendamento NVARCHAR(MAX) NULL
        END
        """
    )


def ensure_candidate_metadata_table(cursor) -> None:
    cursor.execute(
        """
        IF OBJECT_ID('dbo.candidatos_metadata', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.candidatos_metadata (
                id_teste NVARCHAR(120) NOT NULL PRIMARY KEY,
                nome_candidato NVARCHAR(255) NULL,
                habilidades_json NVARCHAR(MAX) NULL,
                tags_json NVARCHAR(MAX) NULL,
                observacao_rh NVARCHAR(MAX) NULL,
                criado_em DATETIME NOT NULL DEFAULT GETDATE(),
                atualizado_em DATETIME NOT NULL DEFAULT GETDATE()
            )
        END
        """
    )


def ensure_interviews_table(cursor) -> None:
    cursor.execute(
        """
        IF OBJECT_ID('dbo.entrevistas_agendadas', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.entrevistas_agendadas (
                id_entrevista INT IDENTITY(1,1) PRIMARY KEY,
                id_processo NVARCHAR(60) NOT NULL,
                id_registro INT NULL,
                id_teste NVARCHAR(120) NULL,
                nome_candidato NVARCHAR(255) NOT NULL,
                vaga NVARCHAR(255) NULL,
                data_entrevista DATETIME NOT NULL,
                status_entrevista NVARCHAR(30) NOT NULL DEFAULT 'Agendado',
                link_agendamento NVARCHAR(MAX) NULL,
                observacoes_rh NVARCHAR(MAX) NULL,
                mensagem_base NVARCHAR(MAX) NULL,
                criado_em DATETIME NOT NULL DEFAULT GETDATE(),
                atualizado_em DATETIME NOT NULL DEFAULT GETDATE()
            )
        END
        """
    )


def describe_database_error(error: Exception) -> str:
    parts = []

    for item in getattr(error, "args", ()):
        text = normalize_text(item)
        if text:
            parts.append(text)

    return " ".join(parts)


def is_deadlock_error(error: Exception) -> bool:
    safe_error = normalize_compare_text(describe_database_error(error))
    return "1205" in safe_error or "deadlock" in safe_error or "40001" in safe_error


def bootstrap_runtime_schema(settings: Settings, *, force: bool = False) -> bool:
    global _SCHEMA_BOOTSTRAPPED

    if _SCHEMA_BOOTSTRAPPED and not force:
        return False

    with _SCHEMA_BOOTSTRAP_LOCK:
        if _SCHEMA_BOOTSTRAPPED and not force:
            return False

        conn = get_connection(settings, autocommit=True)
        try:
            cursor = conn.cursor()
            ensure_process_columns(cursor)
            ensure_pipeline_columns(cursor)
            ensure_candidate_metadata_table(cursor)
            ensure_cv_pre_analises_table(cursor)
            ensure_interviews_table(cursor)
        finally:
            conn.close()

        _SCHEMA_BOOTSTRAPPED = True
        logger.info("Bootstrap de schema complementar do RH concluido com sucesso.")
        return True


def get_next_id_registro(cursor) -> int:
    cursor.execute("SELECT ISNULL(MAX(id_registro), 0) + 1 FROM candidatos_processos")
    row = cursor.fetchone()
    return int(row[0] or 1)


def get_gabaritos_payload_column(cursor) -> str:
    columns = [col.column_name for col in cursor.columns(table="gabaritos", schema="dbo")]
    for name in ("payload_json", "playlaod_json"):
        if name in columns:
            return name

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=f"Coluna de payload nao encontrada na tabela dbo.gabaritos. Colunas disponiveis: {columns}",
    )


def get_process_row(cursor, id_processo: str):
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
        WHERE id_processo = ?
        """,
        (id_processo,),
    )
    row = cursor.fetchone()
    if not row:
        return None

    return dict(zip([column[0] for column in cursor.description], row))


def process_auto_close_if_full(cursor, id_processo: str) -> None:
    cursor.execute(
        """
        SELECT quantidade_vagas, vagas_preenchidas, status
        FROM processos_seletivos
        WHERE id_processo = ?
        """,
        (id_processo,),
    )
    row = cursor.fetchone()
    if not row:
        return

    quantidade_vagas = int(row[0] or 0)
    vagas_preenchidas = int(row[1] or 0)
    status_processo = normalize_text(row[2])

    if status_processo != "Encerrado" and quantidade_vagas > 0 and vagas_preenchidas >= quantidade_vagas:
        cursor.execute(
            """
            UPDATE processos_seletivos
            SET status = ?
            WHERE id_processo = ?
            """,
            ("Encerrado", id_processo),
        )


class DatabaseRepository:
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

    def get_gabaritos_columns(self) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            columns = [col.column_name for col in cursor.columns(table="gabaritos")]
            return {"columns": columns}
        finally:
            conn.close()

    def list_history(self, page: int | None = None, page_size: int = 10, nome: str = "", vaga: str = "", data: str = ""):
        conn = self._connect()
        try:
            cursor = conn.cursor()
            filters = []
            params = []

            if normalize_text(nome):
                filters.append("nome_candidato LIKE ?")
                params.append(f"%{nome.strip()}%")
            if normalize_text(vaga):
                filters.append("vaga LIKE ?")
                params.append(f"%{vaga.strip()}%")
            if normalize_text(data):
                filters.append("data_iso LIKE ?")
                params.append(f"{data.strip()}%")

            base_select = """
                SELECT
                    id_teste,
                    id_processo,
                    nome_candidato,
                    vaga,
                    nivel,
                    trilha,
                    data_iso,
                    data_exibicao,
                    pontuacao_final,
                    status,
                    tempo_minutos,
                    arquivo_gabarito,
                    etapas_json
                FROM historico_provas
            """

            where_clause = f" WHERE {' AND '.join(filters)}" if filters else ""
            if page is None and not filters:
                cursor.execute(base_select)
                return rows_to_dicts(cursor, cursor.fetchall())

            page_safe = max(1, int(page or 1))
            page_size_safe = max(1, min(int(page_size or 10), 100))
            offset = (page_safe - 1) * page_size_safe

            cursor.execute(f"SELECT COUNT(*) FROM historico_provas{where_clause}", tuple(params))
            total_items = int(cursor.fetchone()[0] or 0)

            order_clause = " ORDER BY data_iso DESC, id_teste DESC"
            pagination_clause = " OFFSET ? ROWS FETCH NEXT ? ROWS ONLY"
            cursor.execute(
                f"{base_select}{where_clause}{order_clause}{pagination_clause}",
                tuple(params + [offset, page_size_safe]),
            )
            items = rows_to_dicts(cursor, cursor.fetchall())
            total_pages = max(1, math.ceil(total_items / page_size_safe))
            return {
                "items": items,
                "page": page_safe,
                "page_size": page_size_safe,
                "total_items": total_items,
                "total_pages": total_pages,
            }
        finally:
            conn.close()

    def save_history(self, row: dict) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO historico_provas
                (
                    id_teste,
                    id_processo,
                    nome_candidato,
                    vaga,
                    nivel,
                    trilha,
                    data_iso,
                    data_exibicao,
                    pontuacao_final,
                    status,
                    tempo_minutos,
                    arquivo_gabarito,
                    etapas_json
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    row.get("id_teste", ""),
                    row.get("id_processo", ""),
                    row.get("nome_candidato", ""),
                    row.get("vaga", ""),
                    row.get("nivel", ""),
                    row.get("trilha", ""),
                    row.get("data_iso", ""),
                    row.get("data_exibicao", ""),
                    row.get("pontuacao_final", 0),
                    row.get("status", ""),
                    row.get("tempo_minutos", 0),
                    row.get("arquivo_gabarito", ""),
                    row.get("etapas_json", ""),
                ),
            )
            conn.commit()
            return {"success": True}
        finally:
            conn.close()

    def get_answer_files(self) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            payload_column = get_gabaritos_payload_column(cursor)
            cursor.execute(f"SELECT record_id, {payload_column} FROM gabaritos")
            rows = cursor.fetchall()
            result = {}
            for row in rows:
                result[str(row[0])] = {"content": row[1]}
            return result
        finally:
            conn.close()

    def save_answer_file(self, data: dict) -> dict:
        record_id = data.get("recordId")
        payload = data.get("payload")
        if not record_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="recordId e obrigatorio.")

        payload_text = payload if isinstance(payload, str) else json.dumps(payload, ensure_ascii=False)
        conn = self._connect()
        try:
            cursor = conn.cursor()
            payload_column = get_gabaritos_payload_column(cursor)
            cursor.execute("SELECT COUNT(*) FROM gabaritos WHERE record_id = ?", (record_id,))
            exists = int(cursor.fetchone()[0] or 0)
            if exists:
                cursor.execute(
                    f"UPDATE gabaritos SET {payload_column} = ? WHERE record_id = ?",
                    (payload_text, record_id),
                )
            else:
                cursor.execute(
                    f"INSERT INTO gabaritos (record_id, {payload_column}) VALUES (?, ?)",
                    (record_id, payload_text),
                )
            conn.commit()
            return {"success": True}
        finally:
            conn.close()

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

    def list_talent_bank(self, search: str = "", skill: str = "", tag: str = "") -> list[dict]:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            profile_map = self._get_candidate_profile_map(cursor)
            interview_map = self._get_latest_interview_map(cursor)
            cursor.execute(
                """
                SELECT
                    id_banco,
                    id_processo,
                    id_teste,
                    nome_candidato,
                    vaga,
                    pontuacao_final,
                    data_movimentacao,
                    origem
                FROM banco_talentos
                """
            )
            rows = rows_to_dicts(cursor, cursor.fetchall())
            result = []
            search_term = normalize_compare_text(search)
            skill_term = normalize_compare_text(skill)
            tag_term = normalize_compare_text(tag)

            for item in rows:
                id_teste = normalize_text(item.get("id_teste"))
                profile = profile_map.get(id_teste, {})
                latest_interview = interview_map.get(id_teste, {})
                item["tags"] = profile.get("tags", [])
                item["habilidades"] = profile.get("habilidades", [])
                item["observacao_rh"] = profile.get("observacao_rh", "")
                item["status_entrevista"] = normalize_text(latest_interview.get("status_entrevista"))
                item["data_entrevista"] = latest_interview.get("data_entrevista")
                item["link_entrevista"] = normalize_text(latest_interview.get("link_agendamento"))

                item_search_text = " ".join(
                    [
                        normalize_text(item.get("nome_candidato")),
                        normalize_text(item.get("vaga")),
                        normalize_text(item.get("id_processo")),
                        " ".join(item.get("habilidades", [])),
                        " ".join(item.get("tags", [])),
                    ]
                )
                if search_term and search_term not in normalize_compare_text(item_search_text):
                    continue
                if skill_term and all(skill_term not in normalize_compare_text(skill_item) for skill_item in item.get("habilidades", [])):
                    continue
                if tag_term and all(tag_term not in normalize_compare_text(tag_item) for tag_item in item.get("tags", [])):
                    continue

                result.append(item)

            return result
        finally:
            conn.close()

    def delete_talent_bank_candidate(self, id_banco: int) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM banco_talentos WHERE id_banco = ?", (id_banco,))
            conn.commit()
            return {"success": True}
        finally:
            conn.close()

    def use_talent_bank_candidate(self, id_banco: int, data: dict) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_pipeline_columns(cursor)
            cursor.execute(
                """
                SELECT
                    id_teste,
                    nome_candidato,
                    vaga,
                    pontuacao_final,
                    origem
                FROM banco_talentos
                WHERE id_banco = ?
                """,
                (id_banco,),
            )
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidato do banco de talentos nao encontrado.")

            id_processo = normalize_text(data.get("id_processo"))
            if not id_processo:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Processo de destino nao informado.")

            id_registro = get_next_id_registro(cursor)
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
                    row[0],
                    row[1],
                    row[2],
                    "Em analise",
                    row[3],
                    "",
                    row[4] or "Banco de talentos",
                    "Triagem",
                    datetime.now(),
                ),
            )
            self._upsert_candidate_profile(
                cursor,
                id_teste=row[0],
                nome_candidato=row[1],
            )
            cursor.execute("DELETE FROM banco_talentos WHERE id_banco = ?", (id_banco,))
            conn.commit()
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

    def list_cv_pre_analyses(self, id_processo: str, page: int = 1, page_size: int = 5) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM cv_pre_analises WHERE id_processo = ?", (id_processo,))
            total_items = int(cursor.fetchone()[0] or 0)
            page_safe = max(1, int(page or 1))
            page_size_safe = max(1, min(int(page_size or 5), 50))
            offset = (page_safe - 1) * page_size_safe

            cursor.execute(
                """
                SELECT
                    id_pre_analise,
                    id_processo,
                    nome_candidato,
                    email,
                    telefone,
                    whatsapp,
                    palavras_chave,
                    score_final,
                    classificacao,
                    classificacao_slug,
                    problemas,
                    texto_extraido,
                    nome_arquivo,
                    mime_type,
                    arquivo_original_base64,
                    ja_adicionado_ao_processo,
                    criado_em
                FROM cv_pre_analises
                WHERE id_processo = ?
                ORDER BY id_pre_analise DESC
                OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
                """,
                (id_processo, offset, page_size_safe),
            )
            items = rows_to_dicts(cursor, cursor.fetchall())
            total_pages = max(1, math.ceil(total_items / page_size_safe))
            return {
                "items": items,
                "page": page_safe,
                "page_size": page_size_safe,
                "total_items": total_items,
                "total_pages": total_pages,
            }
        finally:
            conn.close()

    async def create_cv_pre_analysis(
        self,
        id_processo: str,
        arquivo: UploadFile,
        guardar_cv_original: str = "0",
    ) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_cv_pre_analises_table(cursor)
            ensure_pipeline_columns(cursor)

            processo = get_process_row(cursor, id_processo)
            if not processo:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Processo nao encontrado.")

            content = await arquivo.read()
            texto_extraido = extract_text_from_uploaded_file(arquivo.filename, content)
            texto_normalizado = normalize_cv_text(texto_extraido)
            if not texto_normalizado:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Nao foi possivel extrair texto do CV. Para PDF, verifique se o arquivo possui texto selecionavel. Para DOCX, confirme se a biblioteca python-docx esta instalada.",
                )

            nome_candidato = extract_candidate_name(texto_normalizado)
            email = extract_email(texto_normalizado)
            telefone = extract_phone(texto_normalizado)
            whatsapp = extract_whatsapp(texto_normalizado)
            palavras = extract_keywords(texto_normalizado)
            telefone_base = whatsapp or telefone

            if email:
                cursor.execute(
                    """
                    SELECT COUNT(*)
                    FROM cv_pre_analises
                    WHERE id_processo = ? AND email = ?
                    """,
                    (id_processo, email),
                )
                ja_existe = int(cursor.fetchone()[0] or 0)
                if ja_existe:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ja existe uma pre-analise com este e-mail neste processo.")

            education_strength = extract_education_strength(texto_normalizado)
            experience_strength = extract_experience_strength(texto_normalizado)
            avaliacao = score_cv_for_role(
                processo.get("vaga"),
                palavras,
                bool(email),
                bool(telefone_base),
                len(texto_normalizado),
                nome_candidato,
                email,
                telefone_base,
                education_strength,
                experience_strength,
            )

            arquivo_original_base64 = None
            if normalize_compare_text(guardar_cv_original) in {"1", "true"}:
                arquivo_original_base64 = base64.b64encode(content).decode("utf-8")

            cursor.execute(
                """
                INSERT INTO cv_pre_analises
                (
                    id_processo,
                    nome_candidato,
                    email,
                    telefone,
                    whatsapp,
                    palavras_chave,
                    score_final,
                    classificacao,
                    classificacao_slug,
                    problemas,
                    texto_extraido,
                    nome_arquivo,
                    mime_type,
                    arquivo_original_base64,
                    ja_adicionado_ao_processo
                )
                OUTPUT INSERTED.id_pre_analise
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
                """,
                (
                    id_processo,
                    nome_candidato,
                    email,
                    telefone,
                    whatsapp,
                    json.dumps(avaliacao["keywords_validas"], ensure_ascii=False),
                    avaliacao["score"],
                    avaliacao["classificacao"],
                    avaliacao["slug"],
                    serialize_cv_problems(avaliacao),
                    texto_normalizado,
                    arquivo.filename,
                    arquivo.content_type or "application/octet-stream",
                    arquivo_original_base64,
                ),
            )
            id_pre_analise = int(cursor.fetchone()[0])

            if avaliacao["classificacao"] in ("Bom candidato", "Otimo candidato"):
                id_registro = get_next_id_registro(cursor)
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
                        f"CV-{id_pre_analise}",
                        nome_candidato,
                        processo.get("vaga") or "",
                        "Em analise",
                        str(avaliacao["score"]).replace(".", ","),
                        datetime.now().isoformat(),
                        "Pre-analise de CV",
                        "Triagem",
                        datetime.now(),
                    ),
                )
                cursor.execute(
                    """
                    UPDATE cv_pre_analises
                    SET ja_adicionado_ao_processo = 1
                    WHERE id_pre_analise = ?
                    """,
                    (id_pre_analise,),
                )
                self._upsert_candidate_profile(
                    cursor,
                    id_teste=f"CV-{id_pre_analise}",
                    nome_candidato=nome_candidato,
                )

            conn.commit()
            return {"success": True, "id_pre_analise": id_pre_analise}
        finally:
            conn.close()

    def update_cv_pre_analysis(self, id_pre_analise: int, data: dict) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_cv_pre_analises_table(cursor)
            cursor.execute(
                """
                SELECT id_processo, email
                FROM cv_pre_analises
                WHERE id_pre_analise = ?
                """,
                (id_pre_analise,),
            )
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pre-analise nao encontrada.")

            id_processo = normalize_text(row[0])
            novo_email = normalize_text(data.get("email"))
            if novo_email:
                cursor.execute(
                    """
                    SELECT COUNT(*)
                    FROM cv_pre_analises
                    WHERE id_processo = ? AND email = ? AND id_pre_analise <> ?
                    """,
                    (id_processo, novo_email, id_pre_analise),
                )
                duplicado = int(cursor.fetchone()[0] or 0)
                if duplicado:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ja existe outra pre-analise com este e-mail neste processo.")

            cursor.execute(
                """
                UPDATE cv_pre_analises
                SET nome_candidato = ?, email = ?, telefone = ?, whatsapp = ?
                WHERE id_pre_analise = ?
                """,
                (
                    data.get("nome_candidato", ""),
                    novo_email,
                    data.get("telefone", ""),
                    data.get("whatsapp", ""),
                    id_pre_analise,
                ),
            )
            conn.commit()
            return {"success": True}
        finally:
            conn.close()

    def delete_cv_pre_analysis(self, id_pre_analise: int) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_cv_pre_analises_table(cursor)
            cursor.execute("DELETE FROM cv_pre_analises WHERE id_pre_analise = ?", (id_pre_analise,))
            conn.commit()
            return {"success": True}
        finally:
            conn.close()

    def add_cv_pre_analysis_to_process(self, id_pre_analise: int) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            ensure_cv_pre_analises_table(cursor)
            ensure_pipeline_columns(cursor)

            cursor.execute(
                """
                SELECT
                    id_pre_analise,
                    id_processo,
                    nome_candidato,
                    email,
                    score_final,
                    classificacao,
                    ja_adicionado_ao_processo
                FROM cv_pre_analises
                WHERE id_pre_analise = ?
                """,
                (id_pre_analise,),
            )
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pre-analise nao encontrada.")
            if int(row[6] or 0) == 1:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Este CV ja foi adicionado ao processo.")

            processo = get_process_row(cursor, row[1])
            if not processo:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Processo nao encontrado.")

            id_registro = get_next_id_registro(cursor)
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
                    row[1],
                    f"CV-{row[0]}",
                    row[2],
                    processo.get("vaga") or "",
                    "Em analise",
                    str(row[4] or "").replace(".", ","),
                    datetime.now().isoformat(),
                    "Pre-analise de CV",
                    "Triagem",
                    datetime.now(),
                ),
            )
            cursor.execute(
                """
                UPDATE cv_pre_analises
                SET ja_adicionado_ao_processo = 1
                WHERE id_pre_analise = ?
                """,
                (id_pre_analise,),
            )
            self._upsert_candidate_profile(
                cursor,
                id_teste=f"CV-{row[0]}",
                nome_candidato=row[2],
            )
            conn.commit()
            return {"success": True}
        finally:
            conn.close()

    def get_candidate_analytics(self) -> list[dict]:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            process_map = self._get_process_map(cursor)
            process_candidate_map = self._get_process_candidate_map(cursor)
            answer_files_map = self._get_answer_files_map(cursor)

            cursor.execute(
                """
                SELECT
                    id_teste,
                    id_processo,
                    nome_candidato,
                    vaga,
                    nivel,
                    trilha,
                    data_iso,
                    data_exibicao,
                    pontuacao_final,
                    status,
                    tempo_minutos,
                    arquivo_gabarito,
                    etapas_json
                FROM historico_provas
                """
            )
            rows = rows_to_dicts(cursor, cursor.fetchall())
            result = []
            for row in rows:
                id_processo = normalize_text(row.get("id_processo"))
                id_teste = normalize_text(row.get("id_teste"))
                if not id_processo or id_processo.upper() == "PROCESSO_UNICO":
                    continue

                try:
                    analysis = build_analysis_from_payload(
                        row,
                        process_map.get(id_processo, {}),
                        process_candidate_map.get(id_teste, {}),
                        answer_files_map.get(id_teste, {}),
                    )
                    status_candidato = normalize_text(analysis.get("status_candidato"))
                    if normalize_compare_text(status_candidato) not in {"em analise", "banco de talentos", "aprovado"}:
                        continue

                    result.append(
                        {
                            "id_teste": analysis.get("id_teste", ""),
                            "id_processo": analysis.get("id_processo", ""),
                            "nome_candidato": analysis.get("nome_candidato", ""),
                            "vaga": analysis.get("vaga", ""),
                            "nota_final": round(parse_float_br(analysis.get("nota_final", 0)), 1),
                            "afinidade_percentual": round(float(analysis.get("afinidade_percentual", 0) or 0), 1),
                            "recomendacao": analysis.get("recomendacao", ""),
                            "parecer_final": analysis.get("parecer_final", ""),
                            "status_candidato": status_candidato,
                        }
                    )
                except Exception as row_error:
                    logger.warning("Falha ao analisar a prova %s: %s", id_teste, row_error)
                    continue

            return result
        finally:
            conn.close()

    def get_candidate_analytics_detail(self, id_teste: str) -> dict:
        conn = self._connect()
        try:
            cursor = conn.cursor()
            process_map = self._get_process_map(cursor)
            process_candidate_map = self._get_process_candidate_map(cursor)
            answer_files_map = self._get_answer_files_map(cursor)

            cursor.execute(
                """
                SELECT
                    id_teste,
                    id_processo,
                    nome_candidato,
                    vaga,
                    nivel,
                    trilha,
                    data_iso,
                    data_exibicao,
                    pontuacao_final,
                    status,
                    tempo_minutos,
                    arquivo_gabarito,
                    etapas_json
                FROM historico_provas
                WHERE id_teste = ?
                """,
                (id_teste,),
            )
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prova nao encontrada.")

            history_row = rows_to_dicts(cursor, [row])[0]
            return build_analysis_from_payload(
                history_row,
                process_map.get(normalize_text(history_row.get("id_processo")), {}),
                process_candidate_map.get(id_teste, {}),
                answer_files_map.get(id_teste, {}),
            )
        finally:
            conn.close()

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
            status_candidato = normalize_compare_text(row[2])

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

    def upsert_candidate_profile(self, id_teste: str, data: dict) -> dict:
        safe_id_teste = normalize_text(id_teste)
        if not safe_id_teste:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Identificador do candidato nao informado.")

        conn = self._connect()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT TOP 1 nome_candidato
                FROM (
                    SELECT nome_candidato FROM candidatos_processos WHERE id_teste = ?
                    UNION ALL
                    SELECT nome_candidato FROM banco_talentos WHERE id_teste = ?
                    UNION ALL
                    SELECT nome_candidato FROM historico_provas WHERE id_teste = ?
                ) origem
                """,
                (safe_id_teste, safe_id_teste, safe_id_teste),
            )
            candidate_row = cursor.fetchone()
            if not candidate_row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidato nao encontrado para atualizar o perfil.")

            self._upsert_candidate_profile(
                cursor,
                id_teste=safe_id_teste,
                nome_candidato=data.get("nome_candidato") or candidate_row[0],
                habilidades=normalize_string_list(data.get("habilidades", [])),
                tags=normalize_string_list(data.get("tags", [])),
                observacao_rh=data.get("observacao_rh", ""),
            )
            conn.commit()
            logger.info("Perfil RH atualizado para o candidato %s.", safe_id_teste)
            return {"success": True}
        finally:
            conn.close()

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
