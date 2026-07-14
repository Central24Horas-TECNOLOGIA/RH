SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID('dbo.candidatos_metadata', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.candidatos_metadata', 'possui_experiencia') IS NULL
        ALTER TABLE dbo.candidatos_metadata ADD possui_experiencia NVARCHAR(20) NULL;

    IF COL_LENGTH('dbo.candidatos_metadata', 'musica') IS NULL
        ALTER TABLE dbo.candidatos_metadata ADD musica NVARCHAR(255) NULL;

    IF COL_LENGTH('dbo.candidatos_metadata', 'prato') IS NULL
        ALTER TABLE dbo.candidatos_metadata ADD prato NVARCHAR(255) NULL;

    IF COL_LENGTH('dbo.candidatos_metadata', 'futebol') IS NULL
        ALTER TABLE dbo.candidatos_metadata ADD futebol NVARCHAR(255) NULL;

    IF COL_LENGTH('dbo.candidatos_metadata', 'time') IS NULL
        ALTER TABLE dbo.candidatos_metadata ADD time NVARCHAR(255) NULL;

    IF COL_LENGTH('dbo.candidatos_metadata', 'rede_social') IS NULL
        ALTER TABLE dbo.candidatos_metadata ADD rede_social NVARCHAR(500) NULL;
END;

IF OBJECT_ID('dbo.email_inbox_items', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.email_inbox_items', 'experiencia_detectada') IS NULL
        ALTER TABLE dbo.email_inbox_items ADD experiencia_detectada NVARCHAR(20) NULL;

    IF COL_LENGTH('dbo.email_inbox_items', 'trabalhe_conosco') IS NULL
        ALTER TABLE dbo.email_inbox_items ADD trabalhe_conosco BIT NULL;

    IF COL_LENGTH('dbo.email_inbox_items', 'campos_formulario_json') IS NULL
        ALTER TABLE dbo.email_inbox_items ADD campos_formulario_json NVARCHAR(MAX) NULL;

    IF COL_LENGTH('dbo.email_inbox_items', 'curriculo_anexado_informado') IS NULL
        ALTER TABLE dbo.email_inbox_items ADD curriculo_anexado_informado NVARCHAR(20) NULL;

    IF COL_LENGTH('dbo.email_inbox_items', 'inconsistencias_json') IS NULL
        ALTER TABLE dbo.email_inbox_items ADD inconsistencias_json NVARCHAR(MAX) NULL;
END;

COMMIT TRANSACTION;
