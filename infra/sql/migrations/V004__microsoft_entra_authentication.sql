SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    IF COL_LENGTH('dbo.usuarios', 'microsoft_oid') IS NULL
    BEGIN
        ALTER TABLE dbo.usuarios ADD microsoft_oid NVARCHAR(64) NULL;
    END;

    IF COL_LENGTH('dbo.usuarios', 'microsoft_tenant_id') IS NULL
    BEGIN
        ALTER TABLE dbo.usuarios ADD microsoft_tenant_id NVARCHAR(64) NULL;
    END;

    IF COL_LENGTH('dbo.usuarios', 'provedor_autenticacao') IS NULL
    BEGIN
        ALTER TABLE dbo.usuarios ADD provedor_autenticacao NVARCHAR(30) NULL;
    END;

    IF COL_LENGTH('dbo.usuarios', 'ultimo_login_microsoft') IS NULL
    BEGIN
        ALTER TABLE dbo.usuarios ADD ultimo_login_microsoft DATETIME NULL;
    END;

    IF EXISTS (
        SELECT 1
        FROM sys.columns
        WHERE object_id = OBJECT_ID('dbo.usuarios')
          AND name = 'senha_hash'
          AND is_nullable = 0
    )
    BEGIN
        ALTER TABLE dbo.usuarios ALTER COLUMN senha_hash NVARCHAR(500) NULL;
    END;

    IF NOT EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID('dbo.usuarios')
          AND name = 'UX_usuarios_microsoft_identity'
    )
    BEGIN
        EXEC(N'
            CREATE UNIQUE INDEX UX_usuarios_microsoft_identity
            ON dbo.usuarios(microsoft_oid, microsoft_tenant_id)
            WHERE microsoft_oid IS NOT NULL AND microsoft_tenant_id IS NOT NULL;
        ');
    END;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;
    THROW;
END CATCH;
