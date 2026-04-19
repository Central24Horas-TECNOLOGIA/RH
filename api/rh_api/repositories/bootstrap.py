from __future__ import annotations

import logging
import threading

from fastapi import HTTPException, status

from ..config import Settings
from ..db import get_connection
from ..services.helpers import normalize_compare_text, normalize_text


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
