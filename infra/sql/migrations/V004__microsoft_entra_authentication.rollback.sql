SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    IF EXISTS (
        SELECT 1
        FROM dbo.usuarios
        WHERE microsoft_oid IS NOT NULL
           OR microsoft_tenant_id IS NOT NULL
           OR provedor_autenticacao IS NOT NULL
           OR ultimo_login_microsoft IS NOT NULL
    )
    BEGIN
        THROW 51000, 'Rollback bloqueado: existem dados de autenticacao Microsoft em dbo.usuarios.', 1;
    END;

    IF EXISTS (SELECT 1 FROM dbo.usuarios WHERE senha_hash IS NULL)
    BEGIN
        THROW 51001, 'Rollback bloqueado: existem usuarios sem senha local.', 1;
    END;

    IF EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID('dbo.usuarios')
          AND name = 'UX_usuarios_microsoft_identity'
    )
    BEGIN
        DROP INDEX UX_usuarios_microsoft_identity ON dbo.usuarios;
    END;

    IF COL_LENGTH('dbo.usuarios', 'ultimo_login_microsoft') IS NOT NULL
        ALTER TABLE dbo.usuarios DROP COLUMN ultimo_login_microsoft;

    DECLARE @provider_default_constraint SYSNAME;
    SELECT @provider_default_constraint = default_constraints.name
    FROM sys.default_constraints AS default_constraints
    INNER JOIN sys.columns AS columns
        ON columns.object_id = default_constraints.parent_object_id
       AND columns.column_id = default_constraints.parent_column_id
    WHERE default_constraints.parent_object_id = OBJECT_ID('dbo.usuarios')
      AND columns.name = 'provedor_autenticacao';

    IF @provider_default_constraint IS NOT NULL
        EXEC('ALTER TABLE dbo.usuarios DROP CONSTRAINT [' + @provider_default_constraint + ']');

    IF COL_LENGTH('dbo.usuarios', 'provedor_autenticacao') IS NOT NULL
        ALTER TABLE dbo.usuarios DROP COLUMN provedor_autenticacao;

    IF COL_LENGTH('dbo.usuarios', 'microsoft_tenant_id') IS NOT NULL
        ALTER TABLE dbo.usuarios DROP COLUMN microsoft_tenant_id;

    IF COL_LENGTH('dbo.usuarios', 'microsoft_oid') IS NOT NULL
        ALTER TABLE dbo.usuarios DROP COLUMN microsoft_oid;

    IF EXISTS (
        SELECT 1
        FROM sys.columns
        WHERE object_id = OBJECT_ID('dbo.usuarios')
          AND name = 'senha_hash'
          AND is_nullable = 1
    )
    BEGIN
        ALTER TABLE dbo.usuarios ALTER COLUMN senha_hash NVARCHAR(500) NOT NULL;
    END;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;
    THROW;
END CATCH;
