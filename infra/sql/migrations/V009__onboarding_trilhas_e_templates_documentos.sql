/*
  Conecta RH - roadmap de expansao (respostas.txt):
    1) Trilha de onboarding com checklist automatizado.
    2) Geracao automatica de documentos por template com variaveis {{...}}.

  Migracao estritamente aditiva e idempotente. Nenhuma tabela ou coluna
  existente e alterada/removida. Este script reflete o mesmo schema que o
  bootstrap runtime (rh_api/repositories/bootstrap.py) cria automaticamente;
  mantenha os dois em sincronia caso este arquivo seja executado manualmente.
*/
SET XACT_ABORT ON;
SET NOCOUNT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    -- ------------------------------------------------------------------
    -- 1) Trilhas de onboarding (conjunto ordenado de itens de checklist)
    -- ------------------------------------------------------------------
    IF OBJECT_ID('dbo.trilhas_onboarding', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.trilhas_onboarding (
            id_trilha INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_trilhas_onboarding PRIMARY KEY,
            nome NVARCHAR(255) NOT NULL,
            descricao NVARCHAR(MAX) NULL,
            ativo BIT NOT NULL CONSTRAINT DF_trilhas_onboarding_ativo DEFAULT 1,
            criado_por NVARCHAR(180) NULL,
            criado_em DATETIME NOT NULL CONSTRAINT DF_trilhas_onboarding_criado_em DEFAULT GETDATE(),
            atualizado_em DATETIME NOT NULL CONSTRAINT DF_trilhas_onboarding_atualizado_em DEFAULT GETDATE()
        );
    END;

    IF OBJECT_ID('dbo.trilhas_onboarding_itens', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.trilhas_onboarding_itens (
            id_item INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_trilhas_onboarding_itens PRIMARY KEY,
            trilha_id INT NOT NULL,
            titulo NVARCHAR(255) NOT NULL,
            descricao NVARCHAR(MAX) NULL,
            ordem INT NOT NULL CONSTRAINT DF_trilhas_onboarding_itens_ordem DEFAULT 0,
            obrigatorio BIT NOT NULL CONSTRAINT DF_trilhas_onboarding_itens_obrigatorio DEFAULT 1,
            criado_em DATETIME NOT NULL CONSTRAINT DF_trilhas_onboarding_itens_criado_em DEFAULT GETDATE(),
            CONSTRAINT FK_trilhas_onboarding_itens_trilha FOREIGN KEY (trilha_id)
                REFERENCES dbo.trilhas_onboarding (id_trilha)
        );
    END;

    -- ------------------------------------------------------------------
    -- 2) Instancias de onboarding por candidato (snapshot dos itens)
    -- ------------------------------------------------------------------
    IF OBJECT_ID('dbo.onboarding_candidatos', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.onboarding_candidatos (
            id_onboarding INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_onboarding_candidatos PRIMARY KEY,
            id_registro INT NOT NULL,
            trilha_id INT NOT NULL,
            iniciado_por NVARCHAR(180) NULL,
            iniciado_em DATETIME NOT NULL CONSTRAINT DF_onboarding_candidatos_iniciado_em DEFAULT GETDATE(),
            CONSTRAINT FK_onboarding_candidatos_trilha FOREIGN KEY (trilha_id)
                REFERENCES dbo.trilhas_onboarding (id_trilha)
        );
    END;

    IF OBJECT_ID('dbo.onboarding_candidatos_itens', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.onboarding_candidatos_itens (
            id_onboarding_item INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_onboarding_candidatos_itens PRIMARY KEY,
            onboarding_candidato_id INT NOT NULL,
            trilha_item_id INT NULL,
            titulo NVARCHAR(255) NOT NULL,
            descricao NVARCHAR(MAX) NULL,
            ordem INT NOT NULL CONSTRAINT DF_onboarding_candidatos_itens_ordem DEFAULT 0,
            obrigatorio BIT NOT NULL CONSTRAINT DF_onboarding_candidatos_itens_obrigatorio DEFAULT 1,
            concluido BIT NOT NULL CONSTRAINT DF_onboarding_candidatos_itens_concluido DEFAULT 0,
            concluido_em DATETIME NULL,
            concluido_por NVARCHAR(180) NULL,
            CONSTRAINT FK_onboarding_candidatos_itens_onboarding FOREIGN KEY (onboarding_candidato_id)
                REFERENCES dbo.onboarding_candidatos (id_onboarding)
        );
    END;

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = 'IX_onboarding_candidatos_id_registro'
          AND object_id = OBJECT_ID('dbo.onboarding_candidatos')
    )
        CREATE INDEX IX_onboarding_candidatos_id_registro
            ON dbo.onboarding_candidatos (id_registro);

    -- Trilha padrao sensata de RH, 100% editavel depois pela tela.
    IF NOT EXISTS (SELECT 1 FROM dbo.trilhas_onboarding)
    BEGIN
        DECLARE @id_trilha_padrao INT;
        INSERT INTO dbo.trilhas_onboarding (nome, descricao, ativo, criado_por, criado_em, atualizado_em)
        VALUES (
            'Trilha padrão de onboarding',
            'Trilha inicial sugerida pelo RH. Edite os itens conforme a necessidade da operação.',
            1,
            'bootstrap',
            GETDATE(),
            GETDATE()
        );
        SET @id_trilha_padrao = SCOPE_IDENTITY();

        INSERT INTO dbo.trilhas_onboarding_itens (trilha_id, titulo, descricao, ordem, obrigatorio)
        VALUES
            (@id_trilha_padrao, 'Documentação admissional', 'Coletar e validar os documentos exigidos para a admissão.', 1, 1),
            (@id_trilha_padrao, 'Provisionar acessos/e-mail corporativo', 'Criar usuário, e-mail e acessos aos sistemas internos.', 2, 1),
            (@id_trilha_padrao, 'Apresentação da equipe', 'Apresentar o novo colaborador ao time e aos líderes diretos.', 3, 0),
            (@id_trilha_padrao, 'Treinamento inicial da operação', 'Realizar o treinamento inicial sobre processos e ferramentas.', 4, 1),
            (@id_trilha_padrao, 'Entrega de materiais/equipamento', 'Entregar crachá, equipamentos e materiais de trabalho.', 5, 1),
            (@id_trilha_padrao, 'Alinhamento de metas do primeiro mês', 'Alinhar expectativas e metas para os primeiros 30 dias.', 6, 0);
    END;

    -- ------------------------------------------------------------------
    -- 3) Templates de documentos com placeholders {{variavel}}
    -- ------------------------------------------------------------------
    IF OBJECT_ID('dbo.templates_documentos', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.templates_documentos (
            id_template INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_templates_documentos PRIMARY KEY,
            titulo NVARCHAR(255) NOT NULL,
            corpo_texto NVARCHAR(MAX) NOT NULL,
            ativo BIT NOT NULL CONSTRAINT DF_templates_documentos_ativo DEFAULT 1,
            criado_em DATETIME NOT NULL CONSTRAINT DF_templates_documentos_criado_em DEFAULT GETDATE(),
            atualizado_em DATETIME NOT NULL CONSTRAINT DF_templates_documentos_atualizado_em DEFAULT GETDATE()
        );
    END;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
