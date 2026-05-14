from __future__ import annotations

import logging
import re
import threading
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status

from ..config import Settings
from ..db import get_connection
from ..services.helpers import normalize_compare_text, normalize_text, rows_to_dicts


logger = logging.getLogger(__name__)
_SCHEMA_BOOTSTRAP_LOCK = threading.Lock()
_SCHEMA_BOOTSTRAPPED = False
_SQL_IDENTIFIER_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
PROCESS_REF_SEPARATOR = "@@"
LOCAL_TIMEZONE = ZoneInfo("America/Sao_Paulo")

def ensure_cv_pre_analises_table(cursor) -> None:
    cursor.execute(
        """
        IF OBJECT_ID('dbo.cv_pre_analises', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.cv_pre_analises (
                id_pre_analise INT IDENTITY(1,1) PRIMARY KEY,
                id_processo NVARCHAR(60) NULL,
                id_processo_ref NVARCHAR(255) NULL,
                nome_candidato NVARCHAR(255) NULL,
                email NVARCHAR(255) NULL,
                telefone NVARCHAR(50) NULL,
                whatsapp NVARCHAR(50) NULL,
                palavras_chave NVARCHAR(MAX) NULL,
                score_final DECIMAL(5,2) NULL,
                classificacao NVARCHAR(80) NULL,
                classificacao_slug NVARCHAR(80) NULL,
                problemas NVARCHAR(MAX) NULL,
                texto_extraido NVARCHAR(MAX) NULL,
                nome_arquivo NVARCHAR(255) NULL,
                mime_type NVARCHAR(120) NULL,
                arquivo_original_base64 NVARCHAR(MAX) NULL,
                ja_adicionado_ao_processo BIT NULL,
                oculto_na_lista BIT NULL,
                origem NVARCHAR(120) NULL,
                email_uid NVARCHAR(120) NULL,
                email_message_id NVARCHAR(255) NULL,
                email_attachment_name NVARCHAR(255) NULL,
                email_remetente NVARCHAR(255) NULL,
                email_assunto NVARCHAR(500) NULL,
                email_data DATETIME NULL,
                criado_em DATETIME NULL
            )
        END
        """
    )

    for column_name, sql_type in (
        ("id_pre_analise", "INT"),
        ("id_processo", "NVARCHAR(60)"),
        ("id_processo_ref", "NVARCHAR(255)"),
        ("nome_candidato", "NVARCHAR(255)"),
        ("email", "NVARCHAR(255)"),
        ("telefone", "NVARCHAR(50)"),
        ("whatsapp", "NVARCHAR(50)"),
        ("palavras_chave", "NVARCHAR(MAX)"),
        ("score_final", "DECIMAL(5,2)"),
        ("classificacao", "NVARCHAR(80)"),
        ("classificacao_slug", "NVARCHAR(80)"),
        ("problemas", "NVARCHAR(MAX)"),
        ("texto_extraido", "NVARCHAR(MAX)"),
        ("nome_arquivo", "NVARCHAR(255)"),
        ("mime_type", "NVARCHAR(120)"),
        ("arquivo_original_base64", "NVARCHAR(MAX)"),
        ("ja_adicionado_ao_processo", "BIT"),
        ("oculto_na_lista", "BIT"),
        ("origem", "NVARCHAR(120)"),
        ("email_uid", "NVARCHAR(120)"),
        ("email_message_id", "NVARCHAR(255)"),
        ("email_attachment_name", "NVARCHAR(255)"),
        ("email_remetente", "NVARCHAR(255)"),
        ("email_assunto", "NVARCHAR(500)"),
        ("email_data", "DATETIME"),
        ("criado_em", "DATETIME"),
    ):
        cursor.execute(
            f"""
            IF COL_LENGTH('dbo.cv_pre_analises', '{column_name}') IS NULL
            BEGIN
                ALTER TABLE dbo.cv_pre_analises
                ADD {column_name} {sql_type} NULL
            END
            """
        )

    cursor.execute(
        """
        UPDATE dbo.cv_pre_analises
        SET ja_adicionado_ao_processo = 0
        WHERE ja_adicionado_ao_processo IS NULL
        """
    )

    cursor.execute(
        """
        UPDATE dbo.cv_pre_analises
        SET oculto_na_lista = 0
        WHERE oculto_na_lista IS NULL
        """
    )

    cursor.execute(
        """
        UPDATE dbo.cv_pre_analises
        SET origem = 'Analise direta do CV'
        WHERE origem IS NULL OR LTRIM(RTRIM(origem)) = ''
        """
    )

    cursor.execute(
        """
        UPDATE dbo.cv_pre_analises
        SET criado_em = GETDATE()
        WHERE criado_em IS NULL
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
    ensure_candidate_approval_columns(cursor)


def ensure_candidate_approval_columns(cursor) -> None:
    for column_name, sql_type in (
        ("mensagem_aprovacao", "NVARCHAR(MAX)"),
        ("data_comparecimento_aprovacao", "NVARCHAR(40)"),
        ("documentos_aprovacao_json", "NVARCHAR(MAX)"),
        ("anexo_aprovacao_nome", "NVARCHAR(255)"),
        ("anexo_aprovacao_tipo", "NVARCHAR(120)"),
        ("anexo_aprovacao_tamanho", "BIGINT"),
        ("anexo_aprovacao_base64", "NVARCHAR(MAX)"),
        ("aprovado_em", "DATETIME"),
        ("eliminado_em", "DATETIME"),
        ("motivo_eliminacao", "NVARCHAR(120)"),
        ("etapa_eliminacao", "NVARCHAR(120)"),
        ("banco_talentos_em", "DATETIME"),
        ("mensagem_aprovacao_enviada_whatsapp_em", "DATETIME"),
        ("mensagem_aprovacao_enviada_email_em", "DATETIME"),
    ):
        cursor.execute(
            f"""
            IF COL_LENGTH('dbo.candidatos_processos', '{column_name}') IS NULL
            BEGIN
                ALTER TABLE dbo.candidatos_processos
                ADD {column_name} {sql_type} NULL
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
    cursor.execute(
        """
        IF COL_LENGTH('dbo.processos_seletivos', 'link_publico_slug') IS NULL
        BEGIN
            ALTER TABLE dbo.processos_seletivos
            ADD link_publico_slug NVARCHAR(255) NULL
        END
        """
    )
    cursor.execute(
        """
        IF COL_LENGTH('dbo.processos_seletivos', 'link_publico_token') IS NULL
        BEGIN
            ALTER TABLE dbo.processos_seletivos
            ADD link_publico_token NVARCHAR(120) NULL
        END
        """
    )
    cursor.execute(
        """
        IF COL_LENGTH('dbo.processos_seletivos', 'link_publico_ativo') IS NULL
        BEGIN
            ALTER TABLE dbo.processos_seletivos
            ADD link_publico_ativo BIT NOT NULL CONSTRAINT DF_processos_link_publico_ativo DEFAULT 0
        END
        """
    )
    cursor.execute(
        """
        IF COL_LENGTH('dbo.processos_seletivos', 'link_publico_criado_em') IS NULL
        BEGIN
            ALTER TABLE dbo.processos_seletivos
            ADD link_publico_criado_em DATETIME NULL
        END
        """
    )
    cursor.execute(
        """
        IF COL_LENGTH('dbo.processos_seletivos', 'link_publico_desativado_em') IS NULL
        BEGIN
            ALTER TABLE dbo.processos_seletivos
            ADD link_publico_desativado_em DATETIME NULL
        END
        """
    )
    cursor.execute(
        """
        IF COL_LENGTH('dbo.processos_seletivos', 'descricao_publica') IS NULL
        BEGIN
            ALTER TABLE dbo.processos_seletivos
            ADD descricao_publica NVARCHAR(MAX) NULL
        END
        """
    )
    cursor.execute(
        """
        IF COL_LENGTH('dbo.processos_seletivos', 'requisitos_publicos') IS NULL
        BEGIN
            ALTER TABLE dbo.processos_seletivos
            ADD requisitos_publicos NVARCHAR(MAX) NULL
        END
        """
    )
    cursor.execute(
        """
        IF COL_LENGTH('dbo.processos_seletivos', 'responsabilidades_publicas') IS NULL
        BEGIN
            ALTER TABLE dbo.processos_seletivos
            ADD responsabilidades_publicas NVARCHAR(MAX) NULL
        END
        """
    )
    cursor.execute(
        """
        IF COL_LENGTH('dbo.processos_seletivos', 'observacoes_publicas_vaga') IS NULL
        BEGIN
            ALTER TABLE dbo.processos_seletivos
            ADD observacoes_publicas_vaga NVARCHAR(MAX) NULL
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
                email NVARCHAR(255) NULL,
                telefone NVARCHAR(50) NULL,
                whatsapp NVARCHAR(50) NULL,
                cidade NVARCHAR(120) NULL,
                bairro NVARCHAR(120) NULL,
                criado_em DATETIME NOT NULL DEFAULT GETDATE(),
                atualizado_em DATETIME NOT NULL DEFAULT GETDATE()
            )
        END
        """
    )

def ensure_candidate_metadata_columns(cursor) -> None:
    for column_name, sql_type in (
        ("id_teste", "NVARCHAR(120)"),
        ("nome_candidato", "NVARCHAR(255)"),
        ("habilidades_json", "NVARCHAR(MAX)"),
        ("tags_json", "NVARCHAR(MAX)"),
        ("observacao_rh", "NVARCHAR(MAX)"),
        ("email", "NVARCHAR(255)"),
        ("telefone", "NVARCHAR(50)"),
        ("whatsapp", "NVARCHAR(50)"),
        ("cidade", "NVARCHAR(120)"),
        ("bairro", "NVARCHAR(120)"),
        ("criado_em", "DATETIME"),
        ("atualizado_em", "DATETIME"),
    ):
        cursor.execute(
            f"""
            IF COL_LENGTH('dbo.candidatos_metadata', '{column_name}') IS NULL
            BEGIN
                ALTER TABLE dbo.candidatos_metadata
                ADD {column_name} {sql_type} NULL
            END
            """
        )

    cursor.execute(
        """
        UPDATE dbo.candidatos_metadata
        SET criado_em = GETDATE()
        WHERE criado_em IS NULL
        """
    )

    cursor.execute(
        """
        UPDATE dbo.candidatos_metadata
        SET atualizado_em = GETDATE()
        WHERE atualizado_em IS NULL
        """
    )

def ensure_candidate_attachments_table(cursor) -> None:
    cursor.execute(
        """
        IF OBJECT_ID('dbo.candidatos_anexos', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.candidatos_anexos (
                id_anexo INT IDENTITY(1,1) PRIMARY KEY,
                id_teste NVARCHAR(120) NULL,
                id_processo NVARCHAR(60) NULL,
                id_processo_ref NVARCHAR(255) NULL,
                nome_arquivo_original NVARCHAR(255) NULL,
                nome_arquivo_armazenado NVARCHAR(255) NULL,
                tipo_arquivo NVARCHAR(120) NULL,
                caminho_arquivo NVARCHAR(500) NULL,
                tamanho_bytes BIGINT NULL,
                criado_em DATETIME NULL,
                atualizado_em DATETIME NULL
            )
        END
        """
    )

    for column_name, sql_type in (
        ("id_teste", "NVARCHAR(120)"),
        ("id_processo", "NVARCHAR(60)"),
        ("id_processo_ref", "NVARCHAR(255)"),
        ("nome_arquivo_original", "NVARCHAR(255)"),
        ("nome_arquivo_armazenado", "NVARCHAR(255)"),
        ("tipo_arquivo", "NVARCHAR(120)"),
        ("caminho_arquivo", "NVARCHAR(500)"),
        ("tamanho_bytes", "BIGINT"),
        ("criado_em", "DATETIME"),
        ("atualizado_em", "DATETIME"),
    ):
        cursor.execute(
            f"""
            IF COL_LENGTH('dbo.candidatos_anexos', '{column_name}') IS NULL
            BEGIN
                ALTER TABLE dbo.candidatos_anexos
                ADD {column_name} {sql_type} NULL
            END
            """
        )

    cursor.execute(
        """
        UPDATE dbo.candidatos_anexos
        SET criado_em = GETDATE()
        WHERE criado_em IS NULL
        """
    )

    cursor.execute(
        """
        UPDATE dbo.candidatos_anexos
        SET atualizado_em = GETDATE()
        WHERE atualizado_em IS NULL
        """
    )


def ensure_email_inbox_items_table(cursor) -> None:
    cursor.execute(
        """
        IF OBJECT_ID('dbo.email_inbox_items', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.email_inbox_items (
                id NVARCHAR(120) NOT NULL PRIMARY KEY,
                message_uid NVARCHAR(120) NULL,
                message_id NVARCHAR(500) NULL,
                remetente NVARCHAR(500) NULL,
                remetente_nome NVARCHAR(255) NULL,
                assunto NVARCHAR(500) NULL,
                data_recebimento DATETIME NULL,
                resumo NVARCHAR(MAX) NULL,
                corpo_texto NVARCHAR(MAX) NULL,
                nome_detectado NVARCHAR(255) NULL,
                telefone_detectado NVARCHAR(50) NULL,
                email_detectado NVARCHAR(255) NULL,
                vaga_detectada NVARCHAR(255) NULL,
                status NVARCHAR(80) NULL,
                origem NVARCHAR(120) NULL,
                caminho_anexo NVARCHAR(500) NULL,
                nome_anexo NVARCHAR(255) NULL,
                content_type NVARCHAR(120) NULL,
                tamanho_anexo BIGINT NULL,
                attachments_json NVARCHAR(MAX) NULL,
                metadata_path NVARCHAR(500) NULL,
                processo_id NVARCHAR(255) NULL,
                candidato_id NVARCHAR(120) NULL,
                id_pre_analise INT NULL,
                id_registro INT NULL,
                id_banco INT NULL,
                criado_em DATETIME NULL,
                atualizado_em DATETIME NULL,
                ignorado BIT NULL
            )
        END
        """
    )

    for column_name, sql_type in (
        ("id", "NVARCHAR(120)"),
        ("message_uid", "NVARCHAR(120)"),
        ("message_id", "NVARCHAR(500)"),
        ("remetente", "NVARCHAR(500)"),
        ("remetente_nome", "NVARCHAR(255)"),
        ("assunto", "NVARCHAR(500)"),
        ("data_recebimento", "DATETIME"),
        ("resumo", "NVARCHAR(MAX)"),
        ("corpo_texto", "NVARCHAR(MAX)"),
        ("nome_detectado", "NVARCHAR(255)"),
        ("telefone_detectado", "NVARCHAR(50)"),
        ("email_detectado", "NVARCHAR(255)"),
        ("vaga_detectada", "NVARCHAR(255)"),
        ("status", "NVARCHAR(80)"),
        ("origem", "NVARCHAR(120)"),
        ("caminho_anexo", "NVARCHAR(500)"),
        ("nome_anexo", "NVARCHAR(255)"),
        ("content_type", "NVARCHAR(120)"),
        ("tamanho_anexo", "BIGINT"),
        ("attachments_json", "NVARCHAR(MAX)"),
        ("metadata_path", "NVARCHAR(500)"),
        ("processo_id", "NVARCHAR(255)"),
        ("candidato_id", "NVARCHAR(120)"),
        ("id_pre_analise", "INT"),
        ("id_registro", "INT"),
        ("id_banco", "INT"),
        ("criado_em", "DATETIME"),
        ("atualizado_em", "DATETIME"),
        ("ignorado", "BIT"),
    ):
        cursor.execute(
            f"""
            IF COL_LENGTH('dbo.email_inbox_items', '{column_name}') IS NULL
            BEGIN
                ALTER TABLE dbo.email_inbox_items
                ADD {column_name} {sql_type} NULL
            END
            """
        )

    cursor.execute(
        """
        UPDATE dbo.email_inbox_items
        SET status = 'Recebido'
        WHERE status IS NULL OR LTRIM(RTRIM(status)) = ''
        """
    )
    cursor.execute(
        """
        UPDATE dbo.email_inbox_items
        SET origem = 'Recebimento de e-mail'
        WHERE origem IS NULL OR LTRIM(RTRIM(origem)) = ''
        """
    )
    cursor.execute(
        """
        UPDATE dbo.email_inbox_items
        SET criado_em = GETDATE()
        WHERE criado_em IS NULL
        """
    )
    cursor.execute(
        """
        UPDATE dbo.email_inbox_items
        SET atualizado_em = GETDATE()
        WHERE atualizado_em IS NULL
        """
    )
    cursor.execute(
        """
        UPDATE dbo.email_inbox_items
        SET ignorado = 0
        WHERE ignorado IS NULL
        """
    )

    cursor.execute(
        """
        IF NOT EXISTS (
            SELECT 1
            FROM sys.indexes
            WHERE name = 'IX_email_inbox_items_message_id'
              AND object_id = OBJECT_ID('dbo.email_inbox_items')
        )
        BEGIN
            CREATE INDEX IX_email_inbox_items_message_id
            ON dbo.email_inbox_items(message_id)
        END
        """
    )


def ensure_candidate_movements_table(cursor) -> None:
    cursor.execute(
        """
        IF OBJECT_ID('dbo.candidatos_movimentacoes', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.candidatos_movimentacoes (
                id_movimentacao INT IDENTITY(1,1) PRIMARY KEY,
                id_teste NVARCHAR(120) NULL,
                id_registro INT NULL,
                id_processo NVARCHAR(60) NULL,
                id_processo_ref NVARCHAR(255) NULL,
                nome_candidato NVARCHAR(255) NULL,
                vaga NVARCHAR(255) NULL,
                origem_inicial NVARCHAR(120) NULL,
                tipo_movimentacao NVARCHAR(120) NULL,
                status_anterior NVARCHAR(80) NULL,
                status_novo NVARCHAR(80) NULL,
                observacao NVARCHAR(MAX) NULL,
                usuario_responsavel NVARCHAR(120) NULL,
                processo_destino NVARCHAR(255) NULL,
                criado_em DATETIME NOT NULL DEFAULT GETDATE()
            )
        END
        """
    )

    for column_name, sql_type in (
        ("id_teste", "NVARCHAR(120)"),
        ("id_registro", "INT"),
        ("id_processo", "NVARCHAR(60)"),
        ("id_processo_ref", "NVARCHAR(255)"),
        ("nome_candidato", "NVARCHAR(255)"),
        ("vaga", "NVARCHAR(255)"),
        ("origem_inicial", "NVARCHAR(120)"),
        ("tipo_movimentacao", "NVARCHAR(120)"),
        ("status_anterior", "NVARCHAR(80)"),
        ("status_novo", "NVARCHAR(80)"),
        ("observacao", "NVARCHAR(MAX)"),
        ("usuario_responsavel", "NVARCHAR(120)"),
        ("processo_destino", "NVARCHAR(255)"),
        ("criado_em", "DATETIME"),
    ):
        cursor.execute(
            f"""
            IF COL_LENGTH('dbo.candidatos_movimentacoes', '{column_name}') IS NULL
            BEGIN
                ALTER TABLE dbo.candidatos_movimentacoes
                ADD {column_name} {sql_type} NULL
            END
            """
        )

    cursor.execute(
        """
        UPDATE dbo.candidatos_movimentacoes
        SET criado_em = GETDATE()
        WHERE criado_em IS NULL
        """
    )


def ensure_interviews_table(cursor) -> None:
    cursor.execute(
        """
        IF OBJECT_ID('dbo.entrevistas_agendadas', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.entrevistas_agendadas (
                id_entrevista INT IDENTITY(1,1) PRIMARY KEY,
                id_processo NVARCHAR(60) NULL,
                id_processo_ref NVARCHAR(255) NULL,
                id_registro INT NULL,
                id_teste NVARCHAR(120) NULL,
                nome_candidato NVARCHAR(255) NULL,
                vaga NVARCHAR(255) NULL,
                data_entrevista DATETIME NULL,
                status_entrevista NVARCHAR(80) NULL,
                link_agendamento NVARCHAR(MAX) NULL,
                observacoes_rh NVARCHAR(MAX) NULL,
                mensagem_base NVARCHAR(MAX) NULL,
                id_slot INT NULL,
                mensagem_personalizada NVARCHAR(MAX) NULL,
                criado_em DATETIME NULL,
                atualizado_em DATETIME NULL
            )
        END
        """
    )

    for column_name, sql_type in (
        ("id_entrevista", "INT"),
        ("id_processo", "NVARCHAR(60)"),
        ("id_processo_ref", "NVARCHAR(255)"),
        ("id_registro", "INT"),
        ("id_teste", "NVARCHAR(120)"),
        ("nome_candidato", "NVARCHAR(255)"),
        ("vaga", "NVARCHAR(255)"),
        ("data_entrevista", "DATETIME"),
        ("status_entrevista", "NVARCHAR(80)"),
        ("link_agendamento", "NVARCHAR(MAX)"),
        ("observacoes_rh", "NVARCHAR(MAX)"),
        ("mensagem_base", "NVARCHAR(MAX)"),
        ("id_slot", "INT"),
        ("mensagem_personalizada", "NVARCHAR(MAX)"),
        ("criado_em", "DATETIME"),
        ("atualizado_em", "DATETIME"),
    ):
        cursor.execute(
            f"""
            IF COL_LENGTH('dbo.entrevistas_agendadas', '{column_name}') IS NULL
            BEGIN
                ALTER TABLE dbo.entrevistas_agendadas
                ADD {column_name} {sql_type} NULL
            END
            """
        )

    cursor.execute(
        """
        UPDATE dbo.entrevistas_agendadas
        SET criado_em = GETDATE()
        WHERE criado_em IS NULL
        """
    )

    cursor.execute(
        """
        UPDATE dbo.entrevistas_agendadas
        SET atualizado_em = GETDATE()
        WHERE atualizado_em IS NULL
        """
    )

    cursor.execute(
        """
        IF COL_LENGTH('dbo.entrevistas_agendadas', 'id_agendamento') IS NOT NULL
           AND COL_LENGTH('dbo.entrevistas_agendadas', 'id_entrevista') IS NOT NULL
        BEGIN
            UPDATE dbo.entrevistas_agendadas
            SET id_entrevista = id_agendamento
            WHERE id_entrevista IS NULL
        END
        """
    )

def ensure_interview_slots_table(cursor) -> None:
    cursor.execute(
        """
        IF OBJECT_ID('dbo.entrevista_slots', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.entrevista_slots (
                id_slot INT IDENTITY(1,1) PRIMARY KEY,
                id_processo NVARCHAR(60) NULL,
                id_processo_ref NVARCHAR(255) NULL,
                vaga NVARCHAR(255) NULL,
                inicio DATETIME NULL,
                fim DATETIME NULL,
                capacidade_total INT NULL,
                status_slot NVARCHAR(30) NULL,
                id_entrevista INT NULL,
                observacoes_rh NVARCHAR(MAX) NULL,
                criado_em DATETIME NULL,
                atualizado_em DATETIME NULL
            )
        END
        """
    )

    for column_name, sql_type in (
        ("id_processo", "NVARCHAR(60)"),
        ("id_processo_ref", "NVARCHAR(255)"),
        ("vaga", "NVARCHAR(255)"),
        ("inicio", "DATETIME"),
        ("fim", "DATETIME"),
        ("capacidade_total", "INT"),
        ("status_slot", "NVARCHAR(30)"),
        ("id_entrevista", "INT"),
        ("observacoes_rh", "NVARCHAR(MAX)"),
        ("criado_em", "DATETIME"),
        ("atualizado_em", "DATETIME"),
    ):
        cursor.execute(
            f"""
            IF COL_LENGTH('dbo.entrevista_slots', '{column_name}') IS NULL
            BEGIN
                ALTER TABLE dbo.entrevista_slots
                ADD {column_name} {sql_type} NULL
            END
            """
        )

    cursor.execute(
        """
        UPDATE dbo.entrevista_slots
        SET capacidade_total = 1
        WHERE capacidade_total IS NULL OR capacidade_total < 1
        """
    )

    cursor.execute(
        """
        UPDATE dbo.entrevista_slots
        SET status_slot = 'Disponivel'
        WHERE status_slot IS NULL OR LTRIM(RTRIM(status_slot)) = ''
        """
    )

    cursor.execute(
        """
        UPDATE dbo.entrevista_slots
        SET criado_em = GETDATE()
        WHERE criado_em IS NULL
        """
    )

    cursor.execute(
        """
        UPDATE dbo.entrevista_slots
        SET atualizado_em = GETDATE()
        WHERE atualizado_em IS NULL
        """
    )

def _ensure_process_reference_column(cursor, table_name: str) -> None:
    safe_table = normalize_text(table_name)
    if not _SQL_IDENTIFIER_PATTERN.fullmatch(safe_table):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Nao foi possivel preparar a coluna de referencia de processo.",
        )

    cursor.execute(
        f"""
        IF COL_LENGTH('dbo.{safe_table}', 'id_processo_ref') IS NULL
        BEGIN
            ALTER TABLE dbo.{safe_table}
            ADD id_processo_ref NVARCHAR(255) NULL
        END
        """
    )


def ensure_process_reference_columns(cursor) -> None:
    for table_name in (
        "historico_provas",
        "candidatos_processos",
        "entrevistas_agendadas",
        "cv_pre_analises",
        "banco_talentos",
    ):
        _ensure_process_reference_column(cursor, table_name)


def _get_column_type(cursor, table_name: str, column_name: str) -> str:
    safe_table = normalize_text(table_name)
    safe_column = normalize_text(column_name)

    for column in cursor.columns(table=safe_table, schema="dbo"):
        if normalize_compare_text(column.column_name) == normalize_compare_text(safe_column):
            return normalize_compare_text(column.type_name)

    return ""


def _ensure_nullable_decimal_column(cursor, table_name: str, column_name: str, *, precision: int, scale: int) -> None:
    safe_table = normalize_text(table_name)
    safe_column = normalize_text(column_name)

    if not _SQL_IDENTIFIER_PATTERN.fullmatch(safe_table) or not _SQL_IDENTIFIER_PATTERN.fullmatch(safe_column):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Nao foi possivel ajustar a tipagem numerica da tabela.",
        )

    current_type = _get_column_type(cursor, safe_table, safe_column)
    if current_type in {"decimal", "numeric", "float", "real"}:
        return

    if current_type not in {"int", "bigint", "smallint", "tinyint"}:
        return

    cursor.execute(
        f"""
        ALTER TABLE dbo.{safe_table}
        ALTER COLUMN {safe_column} DECIMAL({precision},{scale}) NULL
        """
    )


def ensure_decimal_process_columns(cursor) -> None:
    _ensure_nullable_decimal_column(
        cursor,
        "processos_seletivos",
        "nota_corte",
        precision=5,
        scale=1,
    )
    _ensure_nullable_decimal_column(
        cursor,
        "historico_provas",
        "pontuacao_final",
        precision=5,
        scale=1,
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
            ensure_candidate_metadata_columns(cursor)
            ensure_candidate_attachments_table(cursor)
            ensure_email_inbox_items_table(cursor)
            ensure_cv_pre_analises_table(cursor)
            ensure_interviews_table(cursor)
            ensure_interview_slots_table(cursor)
            ensure_candidate_movements_table(cursor)
            ensure_process_reference_columns(cursor)
            ensure_decimal_process_columns(cursor)
        finally:
            conn.close()

        _SCHEMA_BOOTSTRAPPED = True
        logger.info("Bootstrap de schema complementar do RH concluido com sucesso.")
        return True


def is_identity_column(cursor, table_name: str, column_name: str) -> bool:
    safe_table = normalize_text(table_name)
    safe_column = normalize_text(column_name)
    if not _SQL_IDENTIFIER_PATTERN.fullmatch(safe_table) or not _SQL_IDENTIFIER_PATTERN.fullmatch(safe_column):
        return False

    cursor.execute(
        """
        SELECT COLUMNPROPERTY(OBJECT_ID(?), ?, 'IsIdentity')
        """,
        (f"dbo.{safe_table}", safe_column),
    )
    row = cursor.fetchone()
    return bool(row and int(row[0] or 0) == 1)


def get_next_id_registro(cursor) -> int | None:
    if is_identity_column(cursor, "candidatos_processos", "id_registro"):
        return None
    return get_next_numeric_id(cursor, "candidatos_processos", "id_registro")


def insert_candidate_process_record(
    cursor,
    processo: dict | None = None,
    data: dict | None = None,
    *args,
    **kwargs,
) -> int:
    payload = {}
    for item in (data, *args):
        if isinstance(item, dict):
            payload.update(item)
    payload.update(kwargs)
    process_row = processo or payload.get("processo") or {}
    explicit_id = payload.get("id_registro")
    identity_id_registro = is_identity_column(cursor, "candidatos_processos", "id_registro")
    id_registro = None if identity_id_registro else int(explicit_id or get_next_id_registro(cursor) or 0)
    id_teste = normalize_text(payload.get("id_teste"))
    nome_candidato = normalize_text(payload.get("nome_candidato"))
    status_candidato = normalize_text(payload.get("status_candidato"))

    if not id_teste or not nome_candidato or not status_candidato:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Dados insuficientes para adicionar o candidato ao processo.",
        )

    columns = [
        "id_processo",
        "id_processo_ref",
        "id_teste",
        "nome_candidato",
        "vaga",
        "status_candidato",
        "pontuacao_final",
        "data_prova",
        "origem",
        "etapa_pipeline",
        "data_atualizacao_pipeline",
    ]
    values = [
        payload.get("id_processo") or process_row.get("id_processo"),
        payload.get("id_processo_ref") or process_row.get("id_processo_ref", ""),
        id_teste,
        nome_candidato,
        payload.get("vaga") or process_row.get("vaga") or "",
        status_candidato,
        payload.get("pontuacao_final"),
        payload.get("data_prova") or datetime.now().isoformat(),
        payload.get("origem") or "Pre-analise de CV",
        payload.get("etapa_pipeline") or "Prova",
        payload.get("data_atualizacao_pipeline") or datetime.now(),
    ]
    if not identity_id_registro:
        columns.insert(0, "id_registro")
        values.insert(0, id_registro)

    placeholders = ", ".join("?" for _ in columns)
    cursor.execute(
        f"""
        INSERT INTO candidatos_processos
        (
            {", ".join(columns)}
        )
        OUTPUT INSERTED.id_registro
        VALUES ({placeholders})
        """,
        tuple(values),
    )
    row = cursor.fetchone()
    return int(row[0] or id_registro or 0)


def get_next_numeric_id(cursor, table_name: str, column_name: str) -> int:
    safe_table = normalize_text(table_name)
    safe_column = normalize_text(column_name)

    if not _SQL_IDENTIFIER_PATTERN.fullmatch(safe_table) or not _SQL_IDENTIFIER_PATTERN.fullmatch(safe_column):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Nao foi possivel gerar o proximo identificador numerico solicitado.",
        )

    cursor.execute(f"SELECT ISNULL(MAX({safe_column}), 0) + 1 FROM {safe_table}")
    row = cursor.fetchone()
    return int(row[0] or 1)


def get_next_id_banco(cursor) -> int:
    return get_next_numeric_id(cursor, "banco_talentos", "id_banco")


def get_gabaritos_payload_column(cursor) -> str:
    columns = [col.column_name for col in cursor.columns(table="gabaritos", schema="dbo")]
    for name in ("payload_json", "playlaod_json"):
        if name in columns:
            return name

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=f"Coluna de payload nao encontrada na tabela dbo.gabaritos. Colunas disponiveis: {columns}",
    )


def build_process_reference(id_processo: str | None, data_criacao: str | None) -> str:
    safe_process_id = normalize_text(id_processo)
    safe_created_at = normalize_text(data_criacao)

    if not safe_process_id:
        return ""
    if not safe_created_at:
        return safe_process_id

    return f"{safe_process_id}{PROCESS_REF_SEPARATOR}{safe_created_at}"


def split_process_reference(value: str | None) -> tuple[str, str]:
    safe_value = normalize_text(value)
    if not safe_value:
        return "", ""

    if PROCESS_REF_SEPARATOR not in safe_value:
        return safe_value, ""

    process_id, created_at = safe_value.split(PROCESS_REF_SEPARATOR, 1)
    return normalize_text(process_id), normalize_text(created_at)


def parse_process_datetime(value) -> datetime | None:
    if value in (None, ""):
        return None

    if isinstance(value, datetime):
        dt_value = value
    else:
        safe_value = normalize_text(value)
        if not safe_value:
            return None

        normalized = safe_value
        if normalized.endswith("Z"):
            normalized = f"{normalized[:-1]}+00:00"

        try:
            dt_value = datetime.fromisoformat(normalized)
        except ValueError:
            for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
                try:
                    dt_value = datetime.strptime(safe_value, fmt)
                    break
                except ValueError:
                    dt_value = None
            if dt_value is None:
                return None

    if dt_value.tzinfo is None:
        dt_value = dt_value.replace(tzinfo=LOCAL_TIMEZONE)

    return dt_value.astimezone(timezone.utc)


def decorate_process_row(row: dict | None) -> dict | None:
    if not row:
        return row

    decorated = dict(row)
    decorated["id_processo_ref"] = build_process_reference(
        decorated.get("id_processo"),
        decorated.get("data_criacao"),
    )
    return decorated


def sort_process_rows(rows: list[dict]) -> list[dict]:
    fallback = datetime.min.replace(tzinfo=timezone.utc)
    decorated = [decorate_process_row(row) for row in rows]
    return sorted(
        decorated,
        key=lambda item: (
            parse_process_datetime(item.get("data_criacao")) or fallback,
            normalize_text(item.get("id_processo")),
        ),
    )


def _select_process_row_from_rows(
    rows: list[dict],
    *,
    process_ref: str = "",
    timestamp_values: list | tuple | None = None,
) -> dict | None:
    if not rows:
        return None

    sorted_rows = sort_process_rows(rows)
    _, reference_created_at = split_process_reference(process_ref)

    if reference_created_at:
        for row in sorted_rows:
            if normalize_text(row.get("data_criacao")) == reference_created_at:
                return row

    timestamps = timestamp_values or []
    effective_timestamp = None
    for value in timestamps:
        effective_timestamp = parse_process_datetime(value)
        if effective_timestamp is not None:
            break

    if effective_timestamp is None or len(sorted_rows) == 1:
        return sorted_rows[-1]

    first_start = parse_process_datetime(sorted_rows[0].get("data_criacao"))
    if first_start is not None and effective_timestamp < first_start:
        return sorted_rows[0]

    for index, row in enumerate(sorted_rows):
        row_start = parse_process_datetime(row.get("data_criacao"))
        next_start = (
            parse_process_datetime(sorted_rows[index + 1].get("data_criacao"))
            if index + 1 < len(sorted_rows)
            else None
        )
        if row_start is None:
            continue
        if effective_timestamp >= row_start and (next_start is None or effective_timestamp < next_start):
            return row

    return sorted_rows[-1]


def _select_process_query() -> str:
    return """
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
            link_agendamento,
            link_publico_slug,
            link_publico_token,
            link_publico_ativo,
            link_publico_criado_em,
            link_publico_desativado_em,
            descricao_publica,
            requisitos_publicos,
            responsabilidades_publicas,
            observacoes_publicas_vaga
        FROM processos_seletivos
    """


def get_process_rows(cursor, id_processo_or_ref: str | None = None) -> list[dict]:
    safe_process_id, _ = split_process_reference(id_processo_or_ref)
    query = _select_process_query()
    params = []

    if safe_process_id:
        query += " WHERE id_processo = ?"
        params.append(safe_process_id)

    query += " ORDER BY data_criacao ASC, id_processo ASC"
    cursor.execute(query, tuple(params))
    return sort_process_rows(rows_to_dicts(cursor, cursor.fetchall()))


def get_process_row(cursor, id_processo_or_ref: str):
    safe_process_id, safe_created_at = split_process_reference(id_processo_or_ref)
    if not safe_process_id:
        return None

    rows = get_process_rows(cursor, safe_process_id)
    if not rows:
        return None

    if safe_created_at:
        for row in rows:
            if normalize_text(row.get("data_criacao")) == safe_created_at:
                return row

    return rows[-1]


def resolve_process_row_for_related_record(
    cursor,
    *,
    id_processo: str,
    id_processo_ref: str = "",
    timestamp_values: list | tuple | None = None,
):
    safe_process_id = normalize_text(id_processo)
    if not safe_process_id:
        return None

    rows = get_process_rows(cursor, safe_process_id)
    return _select_process_row_from_rows(
        rows,
        process_ref=id_processo_ref,
        timestamp_values=timestamp_values,
    )


def build_process_where_clause(process_row_or_ref) -> tuple[str, tuple]:
    if isinstance(process_row_or_ref, dict):
        safe_process_id = normalize_text(process_row_or_ref.get("id_processo"))
        safe_created_at = normalize_text(process_row_or_ref.get("data_criacao"))
    else:
        safe_process_id, safe_created_at = split_process_reference(process_row_or_ref)

    if not safe_process_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Identificador do processo nao informado.",
        )

    if safe_created_at:
        return "id_processo = ? AND data_criacao = ?", (safe_process_id, safe_created_at)

    return "id_processo = ?", (safe_process_id,)


def generate_unique_process_id(cursor, requested_process_id: str) -> str:
    base_process_id = normalize_text(requested_process_id)
    if not base_process_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Identificador base do processo nao informado.",
        )

    cursor.execute(
        """
        SELECT id_processo
        FROM processos_seletivos
        WHERE id_processo = ? OR id_processo LIKE ?
        """,
        (base_process_id, f"{base_process_id}-%"),
    )
    existing_ids = {
        normalize_text(row[0])
        for row in cursor.fetchall()
        if normalize_text(row[0])
    }

    if base_process_id not in existing_ids:
        return base_process_id

    suffix = 2
    while True:
        candidate = f"{base_process_id}-{suffix:02d}"
        if candidate not in existing_ids:
            return candidate
        suffix += 1


def process_auto_close_if_full(cursor, process_row_or_ref) -> None:
    where_clause, params = build_process_where_clause(process_row_or_ref)
    cursor.execute(
        f"""
        SELECT quantidade_vagas, vagas_preenchidas, status
        FROM processos_seletivos
        WHERE {where_clause}
        """,
        params,
    )
    row = cursor.fetchone()
    if not row:
        return

    quantidade_vagas = int(row[0] or 0)
    vagas_preenchidas = int(row[1] or 0)
    status_processo = normalize_text(row[2])

    if status_processo != "Encerrado" and quantidade_vagas > 0 and vagas_preenchidas >= quantidade_vagas:
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
