IF COL_LENGTH('dbo.processos_seletivos', 'status_anterior') IS NULL
BEGIN
    ALTER TABLE dbo.processos_seletivos ADD status_anterior NVARCHAR(80) NULL;
END;

IF COL_LENGTH('dbo.processos_seletivos', 'status_operacional_anterior') IS NULL
BEGIN
    ALTER TABLE dbo.processos_seletivos ADD status_operacional_anterior NVARCHAR(80) NULL;
END;

IF COL_LENGTH('dbo.processos_seletivos', 'justificativa_status') IS NULL
BEGIN
    ALTER TABLE dbo.processos_seletivos ADD justificativa_status NVARCHAR(MAX) NULL;
END;

IF COL_LENGTH('dbo.processos_seletivos', 'status_alterado_por') IS NULL
BEGIN
    ALTER TABLE dbo.processos_seletivos ADD status_alterado_por NVARCHAR(180) NULL;
END;

IF COL_LENGTH('dbo.processos_seletivos', 'status_alterado_em') IS NULL
BEGIN
    ALTER TABLE dbo.processos_seletivos ADD status_alterado_em DATETIME NULL;
END;

IF COL_LENGTH('dbo.processos_seletivos', 'ultima_movimentacao_relevante_em') IS NULL
BEGIN
    ALTER TABLE dbo.processos_seletivos ADD ultima_movimentacao_relevante_em DATETIME NULL;
END;

IF COL_LENGTH('dbo.processos_seletivos', 'ultimo_alerta_inatividade_em') IS NULL
BEGIN
    ALTER TABLE dbo.processos_seletivos ADD ultimo_alerta_inatividade_em DATETIME NULL;
END;

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
    );
END;
