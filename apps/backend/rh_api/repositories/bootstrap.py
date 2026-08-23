from __future__ import annotations

import logging
import re
import threading
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status

from ..config import Settings
from ..db import get_connection
from ..passwords import hash_password
from ..rbac import PERMISSION_DEFINITIONS, ROLE_ADMIN, ROLE_DEFINITIONS, ROLE_PERMISSIONS, SETTINGS_CATALOGS
from ..services.helpers import (
    normalize_compare_text,
    normalize_indication_type,
    normalize_text,
    rows_to_dicts,
)
from .exam_analytics_schema import ensure_exam_analytics_tables


logger = logging.getLogger(__name__)
_SCHEMA_BOOTSTRAP_LOCK = threading.Lock()
_SCHEMA_BOOTSTRAPPED = False
_SQL_IDENTIFIER_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
PROCESS_REF_SEPARATOR = "@@"
LOCAL_TIMEZONE = ZoneInfo("America/Sao_Paulo")


def ensure_security_tables(cursor, settings: Settings) -> None:
    cursor.execute(
        """
        IF OBJECT_ID('dbo.perfis', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.perfis (
                id_perfil NVARCHAR(40) NOT NULL PRIMARY KEY,
                nome NVARCHAR(80) NOT NULL,
                nivel NVARCHAR(40) NULL,
                descricao NVARCHAR(500) NULL,
                ativo BIT NOT NULL CONSTRAINT DF_perfis_ativo DEFAULT 1,
                sistema BIT NOT NULL CONSTRAINT DF_perfis_sistema DEFAULT 1,
                criado_em DATETIME NOT NULL DEFAULT GETDATE(),
                atualizado_em DATETIME NOT NULL DEFAULT GETDATE()
            )
        END
        """
    )
    cursor.execute(
        """
        IF OBJECT_ID('dbo.permissoes', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.permissoes (
                chave NVARCHAR(120) NOT NULL PRIMARY KEY,
                modulo NVARCHAR(80) NULL,
                descricao NVARCHAR(500) NULL,
                critica BIT NOT NULL CONSTRAINT DF_permissoes_critica DEFAULT 0,
                criado_em DATETIME NOT NULL DEFAULT GETDATE()
            )
        END
        """
    )
    cursor.execute(
        """
        IF OBJECT_ID('dbo.perfil_permissoes', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.perfil_permissoes (
                id_perfil NVARCHAR(40) NOT NULL,
                chave_permissao NVARCHAR(120) NOT NULL,
                permitido BIT NOT NULL CONSTRAINT DF_perfil_permissoes_permitido DEFAULT 1,
                criado_em DATETIME NOT NULL DEFAULT GETDATE(),
                atualizado_em DATETIME NOT NULL DEFAULT GETDATE(),
                CONSTRAINT PK_perfil_permissoes PRIMARY KEY (id_perfil, chave_permissao)
            )
        END
        """
    )
    cursor.execute(
        """
        IF OBJECT_ID('dbo.usuarios', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.usuarios (
                id_usuario INT IDENTITY(1,1) PRIMARY KEY,
                login NVARCHAR(120) NOT NULL,
                nome NVARCHAR(180) NOT NULL,
                email NVARCHAR(180) NOT NULL,
                perfil_id NVARCHAR(40) NOT NULL,
                status NVARCHAR(30) NOT NULL CONSTRAINT DF_usuarios_status DEFAULT 'Ativo',
                senha_hash NVARCHAR(500) NULL,
                microsoft_oid NVARCHAR(64) NULL,
                microsoft_tenant_id NVARCHAR(64) NULL,
                provedor_autenticacao NVARCHAR(30) NULL CONSTRAINT DF_usuarios_provedor_autenticacao DEFAULT 'local',
                ultimo_login_microsoft DATETIME NULL,
                mfa_enabled BIT NOT NULL CONSTRAINT DF_usuarios_mfa_enabled DEFAULT 0,
                mfa_secret_encrypted NVARCHAR(1000) NULL,
                criado_por NVARCHAR(180) NULL,
                atualizado_por NVARCHAR(180) NULL,
                ultimo_acesso_em DATETIME NULL,
                bloqueado_em DATETIME NULL,
                desativado_em DATETIME NULL,
                criado_em DATETIME NOT NULL DEFAULT GETDATE(),
                atualizado_em DATETIME NOT NULL DEFAULT GETDATE()
            )
        END
        """
    )
    for column_name, sql_type in (
        ("login", "NVARCHAR(120)"),
        ("nome", "NVARCHAR(180)"),
        ("email", "NVARCHAR(180)"),
        ("perfil_id", "NVARCHAR(40)"),
        ("status", "NVARCHAR(30)"),
        ("senha_hash", "NVARCHAR(500)"),
        ("mfa_enabled", "BIT"),
        ("mfa_secret_encrypted", "NVARCHAR(1000)"),
        ("criado_por", "NVARCHAR(180)"),
        ("atualizado_por", "NVARCHAR(180)"),
        ("ultimo_acesso_em", "DATETIME"),
        ("bloqueado_em", "DATETIME"),
        ("desativado_em", "DATETIME"),
        ("criado_em", "DATETIME"),
        ("atualizado_em", "DATETIME"),
    ):
        cursor.execute(
            f"""
            IF COL_LENGTH('dbo.usuarios', '{column_name}') IS NULL
            BEGIN
                ALTER TABLE dbo.usuarios
                ADD {column_name} {sql_type} NULL
            END
            """
        )

    cursor.execute(
        """
        IF OBJECT_ID('dbo.logs_auditoria', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.logs_auditoria (
                id_log INT IDENTITY(1,1) PRIMARY KEY,
                id_usuario INT NULL,
                nome_usuario NVARCHAR(180) NULL,
                email_usuario NVARCHAR(180) NULL,
                perfil_id NVARCHAR(40) NULL,
                perfil_nome NVARCHAR(80) NULL,
                data_hora DATETIME NOT NULL DEFAULT GETDATE(),
                modulo NVARCHAR(80) NULL,
                acao NVARCHAR(120) NULL,
                entidade NVARCHAR(120) NULL,
                entidade_id NVARCHAR(180) NULL,
                valor_anterior NVARCHAR(MAX) NULL,
                valor_novo NVARCHAR(MAX) NULL,
                justificativa NVARCHAR(MAX) NULL,
                origem NVARCHAR(180) NULL,
                sucesso BIT NOT NULL CONSTRAINT DF_logs_auditoria_sucesso DEFAULT 1,
                criado_em DATETIME NOT NULL DEFAULT GETDATE()
            )
        END
        """
    )
    for column_name, sql_type in (
        ("id_usuario", "INT"),
        ("nome_usuario", "NVARCHAR(180)"),
        ("email_usuario", "NVARCHAR(180)"),
        ("perfil_id", "NVARCHAR(40)"),
        ("perfil_nome", "NVARCHAR(80)"),
        ("data_hora", "DATETIME"),
        ("modulo", "NVARCHAR(80)"),
        ("acao", "NVARCHAR(120)"),
        ("entidade", "NVARCHAR(120)"),
        ("entidade_id", "NVARCHAR(180)"),
        ("valor_anterior", "NVARCHAR(MAX)"),
        ("valor_novo", "NVARCHAR(MAX)"),
        ("justificativa", "NVARCHAR(MAX)"),
        ("origem", "NVARCHAR(180)"),
        ("sucesso", "BIT"),
        ("criado_em", "DATETIME"),
    ):
        cursor.execute(
            f"""
            IF COL_LENGTH('dbo.logs_auditoria', '{column_name}') IS NULL
            BEGIN
                ALTER TABLE dbo.logs_auditoria
                ADD {column_name} {sql_type} NULL
            END
            """
        )

    for role in ROLE_DEFINITIONS.values():
        cursor.execute(
            """
            IF NOT EXISTS (SELECT 1 FROM perfis WHERE id_perfil = ?)
            BEGIN
                INSERT INTO perfis (id_perfil, nome, nivel, descricao, ativo, sistema, criado_em, atualizado_em)
                VALUES (?, ?, ?, ?, 1, 1, GETDATE(), GETDATE())
            END
            ELSE
            BEGIN
                UPDATE perfis
                SET nome = ?, nivel = ?, descricao = ?, ativo = 1, sistema = 1, atualizado_em = GETDATE()
                WHERE id_perfil = ?
            END
            """,
            (
                role.id,
                role.id,
                role.name,
                role.level,
                role.description,
                role.name,
                role.level,
                role.description,
                role.id,
            ),
        )

    for permission in PERMISSION_DEFINITIONS.values():
        cursor.execute(
            """
            IF NOT EXISTS (SELECT 1 FROM permissoes WHERE chave = ?)
            BEGIN
                INSERT INTO permissoes (chave, modulo, descricao, critica, criado_em)
                VALUES (?, ?, ?, ?, GETDATE())
            END
            ELSE
            BEGIN
                UPDATE permissoes
                SET modulo = ?, descricao = ?, critica = ?
                WHERE chave = ?
            END
            """,
            (
                permission.key,
                permission.key,
                permission.module,
                permission.description,
                1 if permission.critical else 0,
                permission.module,
                permission.description,
                1 if permission.critical else 0,
                permission.key,
            ),
        )

    for role_id, permissions in ROLE_PERMISSIONS.items():
        for permission_key in permissions:
            cursor.execute(
                """
                IF NOT EXISTS (
                    SELECT 1
                    FROM perfil_permissoes
                    WHERE id_perfil = ? AND chave_permissao = ?
                )
                BEGIN
                    INSERT INTO perfil_permissoes
                    (id_perfil, chave_permissao, permitido, criado_em, atualizado_em)
                    VALUES (?, ?, 1, GETDATE(), GETDATE())
                END
                """,
                (role_id, permission_key, role_id, permission_key),
            )

    cursor.execute(
        """
        IF NOT EXISTS (
            SELECT 1
            FROM sys.indexes
            WHERE name = 'UX_usuarios_login'
              AND object_id = OBJECT_ID('dbo.usuarios')
        )
        BEGIN
            CREATE UNIQUE INDEX UX_usuarios_login ON dbo.usuarios(login)
        END
        """
    )
    cursor.execute(
        """
        IF NOT EXISTS (
            SELECT 1
            FROM sys.indexes
            WHERE name = 'UX_usuarios_email'
              AND object_id = OBJECT_ID('dbo.usuarios')
        )
        BEGIN
            CREATE UNIQUE INDEX UX_usuarios_email ON dbo.usuarios(email)
        END
        """
    )
    cursor.execute(
        """
        IF COL_LENGTH('dbo.usuarios', 'microsoft_oid') IS NOT NULL
           AND COL_LENGTH('dbo.usuarios', 'microsoft_tenant_id') IS NOT NULL
           AND NOT EXISTS (
               SELECT 1
               FROM sys.indexes
               WHERE name = 'UX_usuarios_microsoft_identity'
                 AND object_id = OBJECT_ID('dbo.usuarios')
           )
        BEGIN
            CREATE UNIQUE INDEX UX_usuarios_microsoft_identity
            ON dbo.usuarios(microsoft_oid, microsoft_tenant_id)
            WHERE microsoft_oid IS NOT NULL AND microsoft_tenant_id IS NOT NULL
        END
        """
    )

    default_login = settings.auth_user or "rh"
    default_password = settings.auth_password
    if not default_password:
        logger.warning(
            "Usuário administrativo inicial não foi criado: RH_AUTH_PASSWORD não configurada."
        )
        return
    cursor.execute(
        """
        IF NOT EXISTS (
            SELECT 1
            FROM usuarios
            WHERE LOWER(login) = LOWER(?) OR LOWER(email) = LOWER(?)
        )
        BEGIN
            INSERT INTO usuarios
            (
                login,
                nome,
                email,
                perfil_id,
                status,
                senha_hash,
                criado_por,
                atualizado_por,
                criado_em,
                atualizado_em
            )
            VALUES (?, ?, ?, ?, 'Ativo', ?, 'bootstrap', 'bootstrap', GETDATE(), GETDATE())
        END
        """,
        (
            default_login,
            default_login,
            default_login,
            default_login,
            default_login,
            ROLE_ADMIN,
            hash_password(default_password),
        ),
    )


def ensure_reusable_config_tables(cursor) -> None:
    for definition in SETTINGS_CATALOGS.values():
        table = definition["table"]
        cursor.execute(
            f"""
            IF OBJECT_ID('dbo.{table}', 'U') IS NULL
            BEGIN
                CREATE TABLE dbo.{table} (
                    id_item INT IDENTITY(1,1) PRIMARY KEY,
                    chave NVARCHAR(120) NULL,
                    nome NVARCHAR(180) NOT NULL,
                    descricao NVARCHAR(MAX) NULL,
                    categoria NVARCHAR(120) NULL,
                    payload_json NVARCHAR(MAX) NULL,
                    ativo BIT NOT NULL CONSTRAINT DF_{table}_ativo DEFAULT 1,
                    usado BIT NOT NULL CONSTRAINT DF_{table}_usado DEFAULT 0,
                    criado_em DATETIME NOT NULL DEFAULT GETDATE(),
                    atualizado_em DATETIME NOT NULL DEFAULT GETDATE()
                )
            END
            """
        )
        for column_name, sql_type in (
            ("chave", "NVARCHAR(120)"),
            ("nome", "NVARCHAR(180)"),
            ("descricao", "NVARCHAR(MAX)"),
            ("categoria", "NVARCHAR(120)"),
            ("payload_json", "NVARCHAR(MAX)"),
            ("ativo", "BIT"),
            ("usado", "BIT"),
            ("criado_em", "DATETIME"),
            ("atualizado_em", "DATETIME"),
        ):
            cursor.execute(
                f"""
                IF COL_LENGTH('dbo.{table}', '{column_name}') IS NULL
                BEGIN
                    ALTER TABLE dbo.{table}
                    ADD {column_name} {sql_type} NULL
                END
                """
            )
        cursor.execute(
            f"""
            UPDATE dbo.{table}
            SET ativo = 1
            WHERE ativo IS NULL
            """
        )
        cursor.execute(
            f"""
            UPDATE dbo.{table}
            SET usado = 0
            WHERE usado IS NULL
            """
        )


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
        ("eh_indicacao", "BIT"),
        ("tipo_indicacao", "NVARCHAR(80)"),
        ("indicacao_em", "DATETIME"),
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
    cursor.execute(
        """
        IF COL_LENGTH('dbo.processos_seletivos', 'configuracao_prova_json') IS NULL
        BEGIN
            ALTER TABLE dbo.processos_seletivos
            ADD configuracao_prova_json NVARCHAR(MAX) NULL
        END
        """
    )
    cursor.execute(
        """
        IF COL_LENGTH('dbo.processos_seletivos', 'prova_configurada_em') IS NULL
        BEGIN
            ALTER TABLE dbo.processos_seletivos
            ADD prova_configurada_em DATETIME NULL
        END
        """
    )
    for column_name, sql_type in (
        ("status_anterior", "NVARCHAR(80)"),
        ("status_operacional_anterior", "NVARCHAR(80)"),
        ("justificativa_status", "NVARCHAR(MAX)"),
        ("status_alterado_por", "NVARCHAR(180)"),
        ("status_alterado_em", "DATETIME"),
        ("ultima_movimentacao_relevante_em", "DATETIME"),
        ("ultimo_alerta_inatividade_em", "DATETIME"),
        ("tempo_pausa", "NVARCHAR(80)"),
        ("pausa_inicio_em", "DATETIME"),
        ("pausa_previsao_termino", "DATETIME"),
        ("pausa_retomada_em", "DATETIME"),
    ):
        cursor.execute(
            f"""
            IF COL_LENGTH('dbo.processos_seletivos', '{column_name}') IS NULL
            BEGIN
                ALTER TABLE dbo.processos_seletivos
                ADD {column_name} {sql_type} NULL
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
                classificacao_indicacao NVARCHAR(80) NULL,
                justificativa_indicacao NVARCHAR(MAX) NULL,
                email NVARCHAR(255) NULL,
                telefone NVARCHAR(50) NULL,
                whatsapp NVARCHAR(50) NULL,
                cep NVARCHAR(12) NULL,
                endereco NVARCHAR(255) NULL,
                numero NVARCHAR(30) NULL,
                cidade NVARCHAR(120) NULL,
                bairro NVARCHAR(120) NULL,
                idade INT NULL,
                escolaridade NVARCHAR(160) NULL,
                possui_experiencia NVARCHAR(20) NULL,
                musica NVARCHAR(255) NULL,
                prato NVARCHAR(255) NULL,
                futebol NVARCHAR(255) NULL,
                time NVARCHAR(255) NULL,
                rede_social NVARCHAR(500) NULL,
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
        ("classificacao_indicacao", "NVARCHAR(80)"),
        ("justificativa_indicacao", "NVARCHAR(MAX)"),
        ("email", "NVARCHAR(255)"),
        ("telefone", "NVARCHAR(50)"),
        ("whatsapp", "NVARCHAR(50)"),
        ("cep", "NVARCHAR(12)"),
        ("endereco", "NVARCHAR(255)"),
        ("numero", "NVARCHAR(30)"),
        ("cidade", "NVARCHAR(120)"),
        ("bairro", "NVARCHAR(120)"),
        ("idade", "INT"),
        ("escolaridade", "NVARCHAR(160)"),
        ("possui_experiencia", "NVARCHAR(20)"),
        ("musica", "NVARCHAR(255)"),
        ("prato", "NVARCHAR(255)"),
        ("futebol", "NVARCHAR(255)"),
        ("time", "NVARCHAR(255)"),
        ("rede_social", "NVARCHAR(500)"),
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


def ensure_curriculo_ia_table(cursor) -> None:
    cursor.execute(
        """
        IF OBJECT_ID('dbo.analises_curriculo_ia', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.analises_curriculo_ia (
                id_analise INT IDENTITY(1,1) PRIMARY KEY,
                id_candidato NVARCHAR(120) NOT NULL,
                id_processo NVARCHAR(60) NULL,
                provedor_ia NVARCHAR(50) NULL,
                modelo_ia NVARCHAR(100) NULL,
                versao_prompt NVARCHAR(50) NULL,
                nota_aderencia DECIMAL(5,2) NULL,
                parecer NVARCHAR(50) NULL,
                resumo NVARCHAR(MAX) NULL,
                pontos_fortes NVARCHAR(MAX) NULL,
                pontos_atencao NVARCHAR(MAX) NULL,
                riscos NVARCHAR(MAX) NULL,
                justificativa NVARCHAR(MAX) NULL,
                perguntas_sugeridas_entrevista NVARCHAR(MAX) NULL,
                json_resultado NVARCHAR(MAX) NULL,
                status_analise NVARCHAR(30) NOT NULL
                    CONSTRAINT DF_analises_curriculo_ia_status DEFAULT 'CONCLUIDA',
                erro_analise NVARCHAR(MAX) NULL,
                tokens_entrada INT NULL,
                tokens_saida INT NULL,
                custo_estimado DECIMAL(10,4) NULL,
                revisado_por_humano BIT NOT NULL
                    CONSTRAINT DF_analises_curriculo_ia_revisada DEFAULT 0,
                id_usuario_revisao INT NULL,
                criado_em DATETIME NOT NULL
                    CONSTRAINT DF_analises_curriculo_ia_criado DEFAULT GETDATE(),
                revisado_em DATETIME NULL
            )
        END

        IF NOT EXISTS (
            SELECT 1
            FROM sys.indexes
            WHERE name = 'IX_analises_curriculo_ia_candidato'
              AND object_id = OBJECT_ID('dbo.analises_curriculo_ia')
        )
            CREATE INDEX IX_analises_curriculo_ia_candidato
                ON dbo.analises_curriculo_ia (id_candidato)

        IF NOT EXISTS (
            SELECT 1
            FROM sys.indexes
            WHERE name = 'IX_analises_curriculo_ia_processo'
              AND object_id = OBJECT_ID('dbo.analises_curriculo_ia')
        )
            CREATE INDEX IX_analises_curriculo_ia_processo
                ON dbo.analises_curriculo_ia (id_processo)

        IF NOT EXISTS (
            SELECT 1
            FROM sys.indexes
            WHERE name = 'IX_analises_curriculo_ia_criado_em'
              AND object_id = OBJECT_ID('dbo.analises_curriculo_ia')
        )
            CREATE INDEX IX_analises_curriculo_ia_criado_em
                ON dbo.analises_curriculo_ia (criado_em DESC)
        """
    )


def ensure_process_inactivity_alerts_table(cursor) -> None:
    cursor.execute(
        """
        IF OBJECT_ID('dbo.processos_alertas_inatividade', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.processos_alertas_inatividade (
                id_alerta INT IDENTITY(1,1) PRIMARY KEY,
                id_processo NVARCHAR(120) NOT NULL,
                id_processo_ref NVARCHAR(255) NULL,
                tipo NVARCHAR(80) NOT NULL,
                titulo NVARCHAR(180) NOT NULL,
                mensagem NVARCHAR(MAX) NOT NULL,
                destinatarios NVARCHAR(MAX) NULL,
                status_envio NVARCHAR(80) NULL,
                dias_sem_movimentacao INT NOT NULL,
                data_abertura DATETIME NULL,
                data_ultima_movimentacao DATETIME NULL,
                criado_em DATETIME NOT NULL DEFAULT GETDATE()
            )
        END
        """
    )


def ensure_talent_bank_table(cursor) -> None:
    cursor.execute(
        """
        IF OBJECT_ID('dbo.banco_talentos', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.banco_talentos (
                id_banco INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
                id_processo NVARCHAR(60) NULL,
                id_processo_ref NVARCHAR(255) NULL,
                id_teste NVARCHAR(120) NULL,
                nome_candidato NVARCHAR(255) NULL,
                vaga NVARCHAR(255) NULL,
                pontuacao_final NVARCHAR(60) NULL,
                data_movimentacao DATETIME NULL,
                origem NVARCHAR(120) NULL,
                eh_indicacao BIT NULL,
                tipo_indicacao NVARCHAR(80) NULL,
                indicacao_em DATETIME NULL
            )
        END
        """
    )

    cursor.execute(
        """
        IF COL_LENGTH('dbo.banco_talentos', 'id_banco') IS NULL
        BEGIN
            ALTER TABLE dbo.banco_talentos
            ADD id_banco INT IDENTITY(1,1) NOT NULL
        END
        """
    )

    for column_name, sql_type in (
        ("id_processo", "NVARCHAR(60)"),
        ("id_processo_ref", "NVARCHAR(255)"),
        ("id_teste", "NVARCHAR(120)"),
        ("nome_candidato", "NVARCHAR(255)"),
        ("vaga", "NVARCHAR(255)"),
        ("pontuacao_final", "NVARCHAR(60)"),
        ("data_movimentacao", "DATETIME"),
        ("origem", "NVARCHAR(120)"),
        ("eh_indicacao", "BIT"),
        ("tipo_indicacao", "NVARCHAR(80)"),
        ("indicacao_em", "DATETIME"),
    ):
        cursor.execute(
            f"""
            IF COL_LENGTH('dbo.banco_talentos', '{column_name}') IS NULL
            BEGIN
                ALTER TABLE dbo.banco_talentos
                ADD {column_name} {sql_type} NULL
            END
            """
        )

    cursor.execute(
        """
        UPDATE dbo.banco_talentos
        SET eh_indicacao = 0
        WHERE eh_indicacao IS NULL
        """
    )

    cursor.execute(
        """
        SELECT COLUMNPROPERTY(
            OBJECT_ID('dbo.banco_talentos'),
            'id_banco',
            'IsIdentity'
        )
        """
    )
    identity_row = cursor.fetchone()
    id_banco_is_identity = bool(identity_row and int(identity_row[0] or 0) == 1)

    if not id_banco_is_identity:
        cursor.execute(
            """
            DECLARE @max_id_banco INT;
            SELECT @max_id_banco = ISNULL(MAX(id_banco), 0)
            FROM dbo.banco_talentos
            WHERE id_banco IS NOT NULL;

            ;WITH pendentes AS (
                SELECT
                    id_banco,
                    ROW_NUMBER() OVER (
                        ORDER BY
                            ISNULL(data_movimentacao, CONVERT(DATETIME, '19000101', 112)),
                            ISNULL(id_teste, ''),
                            ISNULL(nome_candidato, '')
                    ) AS ordem
                FROM dbo.banco_talentos
                WHERE id_banco IS NULL
            )
            UPDATE pendentes
            SET id_banco = @max_id_banco + ordem;

            IF NOT EXISTS (
                SELECT 1
                FROM dbo.banco_talentos
                WHERE id_banco IS NULL
            )
            AND NOT EXISTS (
                SELECT id_banco
                FROM dbo.banco_talentos
                GROUP BY id_banco
                HAVING COUNT(*) > 1
            )
            BEGIN
                ALTER TABLE dbo.banco_talentos
                ALTER COLUMN id_banco INT NOT NULL
            END
            """
        )

    cursor.execute(
        """
        IF NOT EXISTS (
            SELECT 1
            FROM sys.key_constraints
            WHERE parent_object_id = OBJECT_ID('dbo.banco_talentos')
              AND type = 'PK'
        )
        AND NOT EXISTS (
            SELECT 1
            FROM dbo.banco_talentos
            WHERE id_banco IS NULL
        )
        AND NOT EXISTS (
            SELECT id_banco
            FROM dbo.banco_talentos
            GROUP BY id_banco
            HAVING COUNT(*) > 1
        )
        BEGIN
            ALTER TABLE dbo.banco_talentos
            ADD CONSTRAINT PK_banco_talentos_id_banco PRIMARY KEY (id_banco)
        END
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
                experiencia_detectada NVARCHAR(20) NULL,
                trabalhe_conosco BIT NULL,
                campos_formulario_json NVARCHAR(MAX) NULL,
                curriculo_anexado_informado NVARCHAR(20) NULL,
                inconsistencias_json NVARCHAR(MAX) NULL,
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
        ("experiencia_detectada", "NVARCHAR(20)"),
        ("trabalhe_conosco", "BIT"),
        ("campos_formulario_json", "NVARCHAR(MAX)"),
        ("curriculo_anexado_informado", "NVARCHAR(20)"),
        ("inconsistencias_json", "NVARCHAR(MAX)"),
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
        ("id_entrevista", "INT"),
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


def ensure_process_dossier_notes_table(cursor) -> None:
    cursor.execute(
        """
        IF OBJECT_ID('dbo.processos_dossie_anotacoes', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.processos_dossie_anotacoes (
                id_anotacao INT IDENTITY(1,1) PRIMARY KEY,
                id_processo NVARCHAR(60) NULL,
                id_processo_ref NVARCHAR(255) NULL,
                id_teste NVARCHAR(120) NULL,
                nome_candidato NVARCHAR(255) NULL,
                texto NVARCHAR(MAX) NULL,
                usuario_responsavel NVARCHAR(180) NULL,
                criado_em DATETIME NOT NULL DEFAULT GETDATE(),
                atualizado_em DATETIME NOT NULL DEFAULT GETDATE()
            )
        END
        """
    )

    for column_name, sql_type in (
        ("id_processo", "NVARCHAR(60)"),
        ("id_processo_ref", "NVARCHAR(255)"),
        ("id_teste", "NVARCHAR(120)"),
        ("nome_candidato", "NVARCHAR(255)"),
        ("texto", "NVARCHAR(MAX)"),
        ("usuario_responsavel", "NVARCHAR(180)"),
        ("criado_em", "DATETIME"),
        ("atualizado_em", "DATETIME"),
    ):
        cursor.execute(
            f"""
            IF COL_LENGTH('dbo.processos_dossie_anotacoes', '{column_name}') IS NULL
            BEGIN
                ALTER TABLE dbo.processos_dossie_anotacoes
                ADD {column_name} {sql_type} NULL
            END
            """
        )

    cursor.execute(
        """
        UPDATE dbo.processos_dossie_anotacoes
        SET criado_em = GETDATE()
        WHERE criado_em IS NULL
        """
    )
    cursor.execute(
        """
        UPDATE dbo.processos_dossie_anotacoes
        SET atualizado_em = criado_em
        WHERE atualizado_em IS NULL
        """
    )


def ensure_conecta_exams_tables(cursor) -> None:
    cursor.execute(
        """
        IF OBJECT_ID('dbo.provas_geradas', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.provas_geradas (
                id_prova INT IDENTITY(1,1) PRIMARY KEY,
                id_teste NVARCHAR(120) NOT NULL,
                id_registro INT NULL,
                id_entrevista INT NULL,
                id_processo NVARCHAR(60) NULL,
                id_processo_ref NVARCHAR(255) NULL,
                nome_candidato NVARCHAR(255) NULL,
                email_acesso NVARCHAR(255) NULL,
                telefone_acesso NVARCHAR(50) NULL,
                cpf NVARCHAR(30) NULL,
                vaga NVARCHAR(255) NULL,
                operacao NVARCHAR(255) NULL,
                trilha NVARCHAR(120) NULL,
                nivel NVARCHAR(80) NULL,
                tempo_total INT NULL,
                quantidade_questoes INT NULL,
                etapas_json NVARCHAR(MAX) NULL,
                categorias_json NVARCHAR(MAX) NULL,
                configuracao_json NVARCHAR(MAX) NULL,
                questoes_json NVARCHAR(MAX) NULL,
                instrucoes_operacao NVARCHAR(MAX) NULL,
                status NVARCHAR(80) NOT NULL DEFAULT 'Gerada',
                codigo_acesso NVARCHAR(4) NOT NULL,
                token_sessao_publica NVARCHAR(160) NULL,
                token_expira_em DATETIME NULL,
                metodo_acesso NVARCHAR(40) NULL,
                tentativas_acesso INT NULL,
                gerada_por NVARCHAR(180) NULL,
                gerada_em DATETIME NOT NULL DEFAULT GETDATE(),
                iniciada_em DATETIME NULL,
                revisada_em DATETIME NULL,
                finalizada_em DATETIME NULL,
                expira_em DATETIME NULL,
                reaberta_em DATETIME NULL,
                reaberta_por NVARCHAR(180) NULL,
                motivo_reabertura NVARCHAR(MAX) NULL,
                respostas_anteriores_mantidas BIT NULL,
                cancelada_em DATETIME NULL,
                cancelada_por NVARCHAR(180) NULL,
                motivo_cancelamento NVARCHAR(MAX) NULL,
                dados_confirmados_em DATETIME NULL,
                atualizado_em DATETIME NOT NULL DEFAULT GETDATE()
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
        ("email_acesso", "NVARCHAR(255)"),
        ("telefone_acesso", "NVARCHAR(50)"),
        ("cpf", "NVARCHAR(30)"),
        ("vaga", "NVARCHAR(255)"),
        ("operacao", "NVARCHAR(255)"),
        ("trilha", "NVARCHAR(120)"),
        ("nivel", "NVARCHAR(80)"),
        ("tempo_total", "INT"),
        ("quantidade_questoes", "INT"),
        ("etapas_json", "NVARCHAR(MAX)"),
        ("categorias_json", "NVARCHAR(MAX)"),
        ("configuracao_json", "NVARCHAR(MAX)"),
        ("questoes_json", "NVARCHAR(MAX)"),
        ("instrucoes_operacao", "NVARCHAR(MAX)"),
        ("status", "NVARCHAR(80)"),
        ("codigo_acesso", "NVARCHAR(4)"),
        ("token_sessao_publica", "NVARCHAR(160)"),
        ("token_expira_em", "DATETIME"),
        ("metodo_acesso", "NVARCHAR(40)"),
        ("tentativas_acesso", "INT"),
        ("gerada_por", "NVARCHAR(180)"),
        ("gerada_em", "DATETIME"),
        ("iniciada_em", "DATETIME"),
        ("revisada_em", "DATETIME"),
        ("finalizada_em", "DATETIME"),
        ("expira_em", "DATETIME"),
        ("reaberta_em", "DATETIME"),
        ("reaberta_por", "NVARCHAR(180)"),
        ("motivo_reabertura", "NVARCHAR(MAX)"),
        ("respostas_anteriores_mantidas", "BIT"),
        ("cancelada_em", "DATETIME"),
        ("cancelada_por", "NVARCHAR(180)"),
        ("motivo_cancelamento", "NVARCHAR(MAX)"),
        ("dados_confirmados_em", "DATETIME"),
        ("atualizado_em", "DATETIME"),
    ):
        cursor.execute(
            f"""
            IF COL_LENGTH('dbo.provas_geradas', '{column_name}') IS NULL
            BEGIN
                ALTER TABLE dbo.provas_geradas
                ADD {column_name} {sql_type} NULL
            END
            """
        )

    cursor.execute(
        """
        IF NOT EXISTS (
            SELECT 1
            FROM sys.indexes
            WHERE name = 'UX_provas_geradas_codigo_acesso'
              AND object_id = OBJECT_ID('dbo.provas_geradas')
        )
        BEGIN
            CREATE UNIQUE INDEX UX_provas_geradas_codigo_acesso
            ON dbo.provas_geradas(codigo_acesso)
        END
        """
    )
    cursor.execute(
        """
        IF NOT EXISTS (
            SELECT 1
            FROM sys.indexes
            WHERE name = 'IX_provas_geradas_email_status'
              AND object_id = OBJECT_ID('dbo.provas_geradas')
        )
        BEGIN
            CREATE INDEX IX_provas_geradas_email_status
            ON dbo.provas_geradas(email_acesso, status)
        END
        """
    )

    cursor.execute(
        """
        IF OBJECT_ID('dbo.respostas_provas', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.respostas_provas (
                id_resposta INT IDENTITY(1,1) PRIMARY KEY,
                id_prova INT NOT NULL,
                id_teste NVARCHAR(120) NOT NULL,
                questao_indice INT NOT NULL,
                questao_id NVARCHAR(120) NULL,
                texto_questao_snapshot NVARCHAR(MAX) NULL,
                alternativas_snapshot NVARCHAR(MAX) NULL,
                resposta_json NVARCHAR(MAX) NULL,
                resposta_correta NVARCHAR(MAX) NULL,
                categoria NVARCHAR(120) NULL,
                peso DECIMAL(8,2) NULL,
                correta BIT NULL,
                nota DECIMAL(8,2) NULL,
                tempo_resposta_segundos INT NULL,
                respondida_em DATETIME NOT NULL DEFAULT GETDATE(),
                atualizado_em DATETIME NOT NULL DEFAULT GETDATE()
            )
        END
        """
    )
    for column_name, sql_type in (
        ("id_prova", "INT"),
        ("id_teste", "NVARCHAR(120)"),
        ("questao_indice", "INT"),
        ("questao_id", "NVARCHAR(120)"),
        ("texto_questao_snapshot", "NVARCHAR(MAX)"),
        ("alternativas_snapshot", "NVARCHAR(MAX)"),
        ("resposta_json", "NVARCHAR(MAX)"),
        ("resposta_correta", "NVARCHAR(MAX)"),
        ("categoria", "NVARCHAR(120)"),
        ("peso", "DECIMAL(8,2)"),
        ("correta", "BIT"),
        ("nota", "DECIMAL(8,2)"),
        ("tempo_resposta_segundos", "INT"),
        ("respondida_em", "DATETIME"),
        ("atualizado_em", "DATETIME"),
    ):
        cursor.execute(
            f"""
            IF COL_LENGTH('dbo.respostas_provas', '{column_name}') IS NULL
            BEGIN
                ALTER TABLE dbo.respostas_provas
                ADD {column_name} {sql_type} NULL
            END
            """
        )

    cursor.execute(
        """
        IF OBJECT_ID('dbo.resultados_provas', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.resultados_provas (
                id_resultado INT IDENTITY(1,1) PRIMARY KEY,
                id_prova INT NOT NULL,
                id_teste NVARCHAR(120) NOT NULL,
                nota_objetiva DECIMAL(8,2) NULL,
                nota_redacao DECIMAL(8,2) NULL,
                nota_excel DECIMAL(8,2) NULL,
                nota_tecnica DECIMAL(8,2) NULL,
                nota_comunicacao DECIMAL(8,2) NULL,
                nota_lgpd DECIMAL(8,2) NULL,
                nota_final_prova DECIMAL(8,2) NULL,
                score_por_categoria_json NVARCHAR(MAX) NULL,
                resumo_etapas_json NVARCHAR(MAX) NULL,
                status_correcao NVARCHAR(80) NULL,
                pendente_avaliacao_manual BIT NULL,
                criado_em DATETIME NOT NULL DEFAULT GETDATE(),
                atualizado_em DATETIME NOT NULL DEFAULT GETDATE()
            )
        END
        """
    )
    for column_name, sql_type in (
        ("id_prova", "INT"),
        ("id_teste", "NVARCHAR(120)"),
        ("nota_objetiva", "DECIMAL(8,2)"),
        ("nota_redacao", "DECIMAL(8,2)"),
        ("nota_excel", "DECIMAL(8,2)"),
        ("nota_tecnica", "DECIMAL(8,2)"),
        ("nota_comunicacao", "DECIMAL(8,2)"),
        ("nota_lgpd", "DECIMAL(8,2)"),
        ("nota_final_prova", "DECIMAL(8,2)"),
        ("score_por_categoria_json", "NVARCHAR(MAX)"),
        ("resumo_etapas_json", "NVARCHAR(MAX)"),
        ("status_correcao", "NVARCHAR(80)"),
        ("pendente_avaliacao_manual", "BIT"),
        ("criado_em", "DATETIME"),
        ("atualizado_em", "DATETIME"),
    ):
        cursor.execute(
            f"""
            IF COL_LENGTH('dbo.resultados_provas', '{column_name}') IS NULL
            BEGIN
                ALTER TABLE dbo.resultados_provas
                ADD {column_name} {sql_type} NULL
            END
            """
        )

    cursor.execute(
        """
        IF OBJECT_ID('dbo.scores_conecta', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.scores_conecta (
                id_score INT IDENTITY(1,1) PRIMARY KEY,
                id_teste NVARCHAR(120) NOT NULL,
                id_prova INT NULL,
                id_processo NVARCHAR(60) NULL,
                id_processo_ref NVARCHAR(255) NULL,
                score_final DECIMAL(8,2) NULL,
                classificacao NVARCHAR(80) NULL,
                confiabilidade NVARCHAR(40) NULL,
                status_analise NVARCHAR(80) NULL,
                componentes_json NVARCHAR(MAX) NULL,
                pontos_fortes_json NVARCHAR(MAX) NULL,
                pontos_atencao_json NVARCHAR(MAX) NULL,
                alertas_criticos_json NVARCHAR(MAX) NULL,
                dados_ausentes_json NVARCHAR(MAX) NULL,
                justificativa NVARCHAR(MAX) NULL,
                calculado_em DATETIME NOT NULL DEFAULT GETDATE(),
                recalculado_por NVARCHAR(180) NULL,
                motivo_recalculo NVARCHAR(MAX) NULL
            )
        END
        """
    )
    for column_name, sql_type in (
        ("id_teste", "NVARCHAR(120)"),
        ("id_prova", "INT"),
        ("id_processo", "NVARCHAR(60)"),
        ("id_processo_ref", "NVARCHAR(255)"),
        ("score_final", "DECIMAL(8,2)"),
        ("classificacao", "NVARCHAR(80)"),
        ("confiabilidade", "NVARCHAR(40)"),
        ("status_analise", "NVARCHAR(80)"),
        ("componentes_json", "NVARCHAR(MAX)"),
        ("pontos_fortes_json", "NVARCHAR(MAX)"),
        ("pontos_atencao_json", "NVARCHAR(MAX)"),
        ("alertas_criticos_json", "NVARCHAR(MAX)"),
        ("dados_ausentes_json", "NVARCHAR(MAX)"),
        ("justificativa", "NVARCHAR(MAX)"),
        ("calculado_em", "DATETIME"),
        ("recalculado_por", "NVARCHAR(180)"),
        ("motivo_recalculo", "NVARCHAR(MAX)"),
    ):
        cursor.execute(
            f"""
            IF COL_LENGTH('dbo.scores_conecta', '{column_name}') IS NULL
            BEGIN
                ALTER TABLE dbo.scores_conecta
                ADD {column_name} {sql_type} NULL
            END
            """
        )

    cursor.execute(
        """
        IF OBJECT_ID('dbo.decisoes_rh', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.decisoes_rh (
                id_decisao INT IDENTITY(1,1) PRIMARY KEY,
                id_teste NVARCHAR(120) NOT NULL,
                id_processo NVARCHAR(60) NULL,
                id_processo_ref NVARCHAR(255) NULL,
                decisao NVARCHAR(80) NOT NULL,
                justificativa NVARCHAR(MAX) NULL,
                observacao NVARCHAR(MAX) NULL,
                usuario_responsavel NVARCHAR(180) NULL,
                data_decisao DATETIME NOT NULL DEFAULT GETDATE(),
                score_no_momento DECIMAL(8,2) NULL,
                classificacao_no_momento NVARCHAR(80) NULL,
                score_considerado BIT NULL
            )
        END
        """
    )
    for column_name, sql_type in (
        ("id_teste", "NVARCHAR(120)"),
        ("id_processo", "NVARCHAR(60)"),
        ("id_processo_ref", "NVARCHAR(255)"),
        ("decisao", "NVARCHAR(80)"),
        ("justificativa", "NVARCHAR(MAX)"),
        ("observacao", "NVARCHAR(MAX)"),
        ("usuario_responsavel", "NVARCHAR(180)"),
        ("data_decisao", "DATETIME"),
        ("score_no_momento", "DECIMAL(8,2)"),
        ("classificacao_no_momento", "NVARCHAR(80)"),
        ("score_considerado", "BIT"),
    ):
        cursor.execute(
            f"""
            IF COL_LENGTH('dbo.decisoes_rh', '{column_name}') IS NULL
            BEGIN
                ALTER TABLE dbo.decisoes_rh
                ADD {column_name} {sql_type} NULL
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
            detail="Não foi possível preparar a coluna de referência de processo.",
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
            detail="Não foi possível ajustar a tipagem numérica da tabela.",
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


def ensure_documento_rh_table(cursor) -> None:
    cursor.execute(
        """
        IF OBJECT_ID('dbo.documentos_rh', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.documentos_rh (
                id_documento INT IDENTITY(1,1) PRIMARY KEY,
                nome NVARCHAR(255) NOT NULL,
                tipo NVARCHAR(20) NOT NULL,
                extensao NVARCHAR(20) NULL,
                mimetype NVARCHAR(150) NULL,
                tamanho_bytes BIGINT NULL,
                caminho_arquivo NVARCHAR(500) NULL,
                nome_arquivo_armazenado NVARCHAR(255) NULL,
                id_pasta_pai INT NULL,
                criado_por NVARCHAR(180) NULL,
                criado_em DATETIME NOT NULL DEFAULT GETDATE(),
                atualizado_em DATETIME NOT NULL DEFAULT GETDATE()
            )
        END
        """
    )

    for column_name, sql_type in (
        ("nome", "NVARCHAR(255)"),
        ("tipo", "NVARCHAR(20)"),
        ("extensao", "NVARCHAR(20)"),
        ("mimetype", "NVARCHAR(150)"),
        ("tamanho_bytes", "BIGINT"),
        ("caminho_arquivo", "NVARCHAR(500)"),
        ("nome_arquivo_armazenado", "NVARCHAR(255)"),
        ("id_pasta_pai", "INT"),
        ("criado_por", "NVARCHAR(180)"),
        ("criado_em", "DATETIME"),
        ("atualizado_em", "DATETIME"),
    ):
        cursor.execute(
            f"""
            IF COL_LENGTH('dbo.documentos_rh', '{column_name}') IS NULL
            BEGIN
                ALTER TABLE dbo.documentos_rh
                ADD {column_name} {sql_type} NULL
            END
            """
        )

    cursor.execute(
        """
        UPDATE dbo.documentos_rh
        SET criado_em = GETDATE()
        WHERE criado_em IS NULL
        """
    )
    cursor.execute(
        """
        UPDATE dbo.documentos_rh
        SET atualizado_em = criado_em
        WHERE atualizado_em IS NULL
        """
    )

    cursor.execute(
        """
        IF NOT EXISTS (
            SELECT 1
            FROM sys.indexes
            WHERE name = 'IX_documentos_rh_pasta_pai'
              AND object_id = OBJECT_ID('dbo.documentos_rh')
        )
        BEGIN
            CREATE INDEX IX_documentos_rh_pasta_pai
            ON dbo.documentos_rh(id_pasta_pai)
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
            ensure_security_tables(cursor, settings)
            ensure_reusable_config_tables(cursor)
            ensure_process_columns(cursor)
            ensure_pipeline_columns(cursor)
            ensure_candidate_metadata_table(cursor)
            ensure_candidate_metadata_columns(cursor)
            ensure_candidate_attachments_table(cursor)
            ensure_curriculo_ia_table(cursor)
            ensure_talent_bank_table(cursor)
            ensure_email_inbox_items_table(cursor)
            ensure_cv_pre_analises_table(cursor)
            ensure_interviews_table(cursor)
            ensure_interview_slots_table(cursor)
            ensure_candidate_movements_table(cursor)
            ensure_process_dossier_notes_table(cursor)
            ensure_conecta_exams_tables(cursor)
            ensure_exam_analytics_tables(cursor, create_if_missing=True)
            ensure_process_reference_columns(cursor)
            ensure_decimal_process_columns(cursor)
            ensure_documento_rh_table(cursor)
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

    ensure_candidate_approval_columns(cursor)
    indication_type = normalize_indication_type(payload.get("tipo_indicacao"))
    is_indication = bool(payload.get("eh_indicacao")) or bool(indication_type)
    if bool(payload.get("eh_indicacao")) and not indication_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selecione o tipo de indicação.",
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
        "eh_indicacao",
        "tipo_indicacao",
        "indicacao_em",
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
        payload.get("origem") or "Pré-análise de CV",
        payload.get("etapa_pipeline") or "Prova",
        payload.get("data_atualizacao_pipeline") or datetime.now(),
        1 if is_indication else 0,
        indication_type,
        datetime.now() if is_indication else None,
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
            detail="Não foi possível gerar o próximo identificador numérico solicitado.",
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
        detail=f"Coluna de payload não encontrada na tabela dbo.gabaritos. Colunas disponíveis: {columns}",
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
            observacoes_publicas_vaga,
            configuracao_prova_json,
            prova_configurada_em
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
            detail="Identificador do processo não informado.",
        )

    if safe_created_at:
        return "id_processo = ? AND data_criacao = ?", (safe_process_id, safe_created_at)

    return "id_processo = ?", (safe_process_id,)


def generate_unique_process_id(cursor, requested_process_id: str) -> str:
    base_process_id = normalize_text(requested_process_id)
    if not base_process_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Identificador base do processo não informado.",
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
