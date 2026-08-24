/*
  Conecta RH - roadmap de expansao (respostas.txt): indicacao interna,
  confirmacao de leitura de politicas e calendario de datas comemorativas.

  Migracao estritamente aditiva e idempotente. Nenhuma tabela ou coluna
  existente e alterada/removida. Este script reflete o mesmo schema que o
  bootstrap runtime (rh_api/repositories/bootstrap.py) cria automaticamente;
  mantenha os dois em sincronia caso este arquivo seja executado manualmente.
*/
SET XACT_ABORT ON;
SET NOCOUNT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    -- 1) Programa de indicacao interna: nome de quem indicou o candidato.
    IF COL_LENGTH('dbo.candidatos_processos', 'indicado_por') IS NULL
        ALTER TABLE dbo.candidatos_processos ADD indicado_por NVARCHAR(255) NULL;

    -- 2) Confirmacao de leitura de politicas institucionais.
    IF OBJECT_ID('dbo.politicas', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.politicas (
            id_politica INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_politicas PRIMARY KEY,
            titulo NVARCHAR(255) NOT NULL,
            corpo_texto NVARCHAR(MAX) NOT NULL,
            versao INT NOT NULL CONSTRAINT DF_politicas_versao DEFAULT 1,
            ativo BIT NOT NULL CONSTRAINT DF_politicas_ativo DEFAULT 1,
            criado_por NVARCHAR(180) NULL,
            atualizado_por NVARCHAR(180) NULL,
            criado_em DATETIME NOT NULL CONSTRAINT DF_politicas_criado DEFAULT GETDATE(),
            atualizado_em DATETIME NOT NULL CONSTRAINT DF_politicas_atualizado DEFAULT GETDATE()
        );
    END;

    IF OBJECT_ID('dbo.politicas_confirmacoes', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.politicas_confirmacoes (
            id_confirmacao INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_politicas_confirmacoes PRIMARY KEY,
            id_politica INT NOT NULL,
            id_usuario INT NULL,
            usuario_login NVARCHAR(180) NOT NULL,
            usuario_nome NVARCHAR(180) NULL,
            versao_confirmada INT NOT NULL CONSTRAINT DF_politicas_confirmacoes_versao DEFAULT 1,
            confirmado_em DATETIME NOT NULL CONSTRAINT DF_politicas_confirmacoes_confirmado DEFAULT GETDATE(),
            CONSTRAINT FK_politicas_confirmacoes_politica FOREIGN KEY (id_politica) REFERENCES dbo.politicas(id_politica)
        );
    END;

    IF COL_LENGTH('dbo.politicas_confirmacoes', 'versao_confirmada') IS NULL
        ALTER TABLE dbo.politicas_confirmacoes ADD versao_confirmada INT NOT NULL CONSTRAINT DF_politicas_confirmacoes_versao DEFAULT 1;

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID('dbo.politicas_confirmacoes') AND name = 'UX_politicas_confirmacoes_usuario'
    )
        CREATE UNIQUE INDEX UX_politicas_confirmacoes_usuario
            ON dbo.politicas_confirmacoes(id_politica, usuario_login);

    -- 3) Calendario de datas comemorativas (dia/mes, recorrencia anual sem
    --    precisar recadastrar todo ano).
    IF OBJECT_ID('dbo.datas_comemorativas', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.datas_comemorativas (
            id_data INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_datas_comemorativas PRIMARY KEY,
            titulo NVARCHAR(255) NOT NULL,
            dia INT NOT NULL,
            mes INT NOT NULL,
            descricao NVARCHAR(1000) NULL,
            criado_por NVARCHAR(180) NULL,
            criado_em DATETIME NOT NULL CONSTRAINT DF_datas_comemorativas_criado DEFAULT GETDATE(),
            atualizado_em DATETIME NOT NULL CONSTRAINT DF_datas_comemorativas_atualizado DEFAULT GETDATE(),
            CONSTRAINT CK_datas_comemorativas_dia CHECK (dia BETWEEN 1 AND 31),
            CONSTRAINT CK_datas_comemorativas_mes CHECK (mes BETWEEN 1 AND 12)
        );
    END;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
