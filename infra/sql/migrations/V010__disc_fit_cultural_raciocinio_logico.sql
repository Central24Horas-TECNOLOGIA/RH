/*
  Conecta RH - roadmap de expansao (respostas.txt):
    1) Teste DISC proprio (Conecta Provas), calibrado para o perfil Call Center.
    2) Fit cultural aprofundado (valores da empresa + frases + resposta Likert).
    3) Teste de raciocinio logico/numerico com correcao automatica por gabarito.
    4) Feedback qualitativo automatico (coluna feedback_erro no banco de
       questoes de raciocinio; a camada de texto para as demais provas e
       calculada em tempo de leitura, sem gravar nada novo no banco).

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
    -- 1) Teste DISC - banco de blocos/frases e aplicacoes por candidato
    -- ------------------------------------------------------------------
    IF OBJECT_ID('dbo.disc_blocos', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.disc_blocos (
            id_bloco INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_disc_blocos PRIMARY KEY,
            ordem INT NOT NULL CONSTRAINT DF_disc_blocos_ordem DEFAULT 0,
            ativo BIT NOT NULL CONSTRAINT DF_disc_blocos_ativo DEFAULT 1,
            criado_em DATETIME NOT NULL CONSTRAINT DF_disc_blocos_criado_em DEFAULT GETDATE()
        );
    END;

    IF OBJECT_ID('dbo.disc_frases', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.disc_frases (
            id_frase INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_disc_frases PRIMARY KEY,
            bloco_id INT NOT NULL,
            dimensao CHAR(1) NOT NULL CONSTRAINT CK_disc_frases_dimensao CHECK (dimensao IN ('D', 'I', 'S', 'C')),
            texto NVARCHAR(500) NOT NULL,
            ordem INT NOT NULL CONSTRAINT DF_disc_frases_ordem DEFAULT 0,
            CONSTRAINT FK_disc_frases_bloco FOREIGN KEY (bloco_id)
                REFERENCES dbo.disc_blocos (id_bloco)
        );
    END;

    IF OBJECT_ID('dbo.disc_aplicacoes', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.disc_aplicacoes (
            id_aplicacao INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_disc_aplicacoes PRIMARY KEY,
            id_teste NVARCHAR(60) NOT NULL,
            id_processo_ref INT NULL,
            status NVARCHAR(30) NOT NULL CONSTRAINT DF_disc_aplicacoes_status DEFAULT 'Disponivel',
            iniciada_em DATETIME NULL,
            finalizada_em DATETIME NULL,
            resultado_json NVARCHAR(MAX) NULL,
            criada_em DATETIME NOT NULL CONSTRAINT DF_disc_aplicacoes_criada_em DEFAULT GETDATE()
        );
    END;

    IF OBJECT_ID('dbo.disc_respostas', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.disc_respostas (
            id_resposta INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_disc_respostas PRIMARY KEY,
            aplicacao_id INT NOT NULL,
            bloco_id INT NOT NULL,
            frase_mais_id INT NOT NULL,
            frase_menos_id INT NOT NULL,
            respondido_em DATETIME NOT NULL CONSTRAINT DF_disc_respostas_respondido_em DEFAULT GETDATE(),
            CONSTRAINT FK_disc_respostas_aplicacao FOREIGN KEY (aplicacao_id)
                REFERENCES dbo.disc_aplicacoes (id_aplicacao)
        );
    END;

    -- ------------------------------------------------------------------
    -- 2) Fit cultural - valores da empresa, frases e respostas Likert
    -- ------------------------------------------------------------------
    IF OBJECT_ID('dbo.valores_empresa', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.valores_empresa (
            id_valor INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_valores_empresa PRIMARY KEY,
            nome NVARCHAR(150) NOT NULL,
            descricao NVARCHAR(MAX) NULL,
            ativo BIT NOT NULL CONSTRAINT DF_valores_empresa_ativo DEFAULT 1,
            criado_em DATETIME NOT NULL CONSTRAINT DF_valores_empresa_criado_em DEFAULT GETDATE(),
            atualizado_em DATETIME NOT NULL CONSTRAINT DF_valores_empresa_atualizado_em DEFAULT GETDATE()
        );
    END;

    IF OBJECT_ID('dbo.valores_empresa_frases', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.valores_empresa_frases (
            id_frase INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_valores_empresa_frases PRIMARY KEY,
            valor_id INT NOT NULL,
            frase NVARCHAR(500) NOT NULL,
            ordem INT NOT NULL CONSTRAINT DF_valores_empresa_frases_ordem DEFAULT 0,
            CONSTRAINT FK_valores_empresa_frases_valor FOREIGN KEY (valor_id)
                REFERENCES dbo.valores_empresa (id_valor)
        );
    END;

    IF OBJECT_ID('dbo.fit_cultural_respostas', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.fit_cultural_respostas (
            id_resposta INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_fit_cultural_respostas PRIMARY KEY,
            candidato_processo_id INT NOT NULL,
            frase_id INT NOT NULL,
            nota_concordancia INT NOT NULL CONSTRAINT CK_fit_cultural_respostas_nota CHECK (nota_concordancia BETWEEN 1 AND 5),
            respondido_em DATETIME NOT NULL CONSTRAINT DF_fit_cultural_respostas_respondido_em DEFAULT GETDATE(),
            CONSTRAINT FK_fit_cultural_respostas_frase FOREIGN KEY (frase_id)
                REFERENCES dbo.valores_empresa_frases (id_frase)
        );
    END;

    -- ------------------------------------------------------------------
    -- 3) Raciocinio logico/numerico - banco de questoes e aplicacoes
    -- ------------------------------------------------------------------
    IF OBJECT_ID('dbo.raciocinio_perguntas', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.raciocinio_perguntas (
            id_pergunta INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_raciocinio_perguntas PRIMARY KEY,
            enunciado NVARCHAR(MAX) NOT NULL,
            tipo NVARCHAR(30) NOT NULL CONSTRAINT CK_raciocinio_perguntas_tipo
                CHECK (tipo IN ('sequencia_logica', 'interpretacao_numerica', 'problema_matematico')),
            alternativas_json NVARCHAR(MAX) NOT NULL,
            gabarito INT NOT NULL,
            dificuldade NVARCHAR(20) NOT NULL CONSTRAINT CK_raciocinio_perguntas_dificuldade
                CHECK (dificuldade IN ('facil', 'medio', 'dificil')),
            feedback_erro NVARCHAR(500) NULL,
            ativo BIT NOT NULL CONSTRAINT DF_raciocinio_perguntas_ativo DEFAULT 1,
            criado_em DATETIME NOT NULL CONSTRAINT DF_raciocinio_perguntas_criado_em DEFAULT GETDATE()
        );
    END;

    IF OBJECT_ID('dbo.raciocinio_aplicacoes', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.raciocinio_aplicacoes (
            id_aplicacao INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_raciocinio_aplicacoes PRIMARY KEY,
            id_teste NVARCHAR(60) NOT NULL,
            id_processo_ref INT NULL,
            perguntas_snapshot_json NVARCHAR(MAX) NOT NULL,
            tempo_limite_minutos INT NULL,
            status NVARCHAR(30) NOT NULL CONSTRAINT DF_raciocinio_aplicacoes_status DEFAULT 'Disponivel',
            iniciada_em DATETIME NULL,
            finalizada_em DATETIME NULL,
            resultado_json NVARCHAR(MAX) NULL,
            criada_em DATETIME NOT NULL CONSTRAINT DF_raciocinio_aplicacoes_criada_em DEFAULT GETDATE()
        );
    END;

    IF OBJECT_ID('dbo.raciocinio_respostas', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.raciocinio_respostas (
            id_resposta INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_raciocinio_respostas PRIMARY KEY,
            aplicacao_id INT NOT NULL,
            pergunta_id INT NOT NULL,
            alternativa_marcada INT NULL,
            correta BIT NOT NULL CONSTRAINT DF_raciocinio_respostas_correta DEFAULT 0,
            respondido_em DATETIME NOT NULL CONSTRAINT DF_raciocinio_respostas_respondido_em DEFAULT GETDATE(),
            CONSTRAINT FK_raciocinio_respostas_aplicacao FOREIGN KEY (aplicacao_id)
                REFERENCES dbo.raciocinio_aplicacoes (id_aplicacao)
        );
    END;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0
        ROLLBACK TRANSACTION;
    THROW;
END CATCH;
