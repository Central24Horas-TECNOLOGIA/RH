/*
  Conecta RH - Correcoes.txt (rodada de 03/set/2026): evolucao da Central de
  Treinamentos.

  - dbo.trilhas_onboarding ganha conteudo_json: o slide/script do treinamento
    (formato ainda em aberto com o RH) que a tela "Comecar Treinamento" le e
    apresenta como um curso online, com barra de progresso.
  - dbo.onboarding_candidatos ganha acesso_plataforma/metodo_login (editar:
    se o colaborador tera acesso ao app/plataforma auxiliar e como fara
    login) e presenca (lista de presenca por treinamento agendado; ao salvar,
    o registro ganha a tag APLICADO via status='aplicado').
  - Nova tabela dbo.processos_treinamentos: liga um processo seletivo aos
    treinamentos escolhidos na criacao da vaga. Cada linha nasce com todas as
    vagas do processo bloqueadas (tag AGUARDANDO PROCESSO); o Gestor libera
    parte antes do encerramento (tag ABERTO), o que cria o onboarding real
    dos candidatos aprovados escolhidos.

  Migracao estritamente aditiva e idempotente. Nenhuma tabela ou coluna
  existente e alterada/removida. Reflete o mesmo schema que o bootstrap
  runtime (rh_api/repositories/bootstrap.py, ensure_onboarding_tables e
  ensure_process_trainings_table) cria automaticamente; mantenha os dois em
  sincronia caso este arquivo seja executado manualmente.
*/
SET XACT_ABORT ON;
SET NOCOUNT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    IF COL_LENGTH('dbo.trilhas_onboarding', 'conteudo_json') IS NULL
        ALTER TABLE dbo.trilhas_onboarding ADD conteudo_json NVARCHAR(MAX) NULL;

    IF COL_LENGTH('dbo.onboarding_candidatos', 'acesso_plataforma') IS NULL
        ALTER TABLE dbo.onboarding_candidatos ADD acesso_plataforma BIT NULL;
    IF COL_LENGTH('dbo.onboarding_candidatos', 'metodo_login') IS NULL
        ALTER TABLE dbo.onboarding_candidatos ADD metodo_login NVARCHAR(20) NULL;
    IF COL_LENGTH('dbo.onboarding_candidatos', 'presenca') IS NULL
        ALTER TABLE dbo.onboarding_candidatos ADD presenca NVARCHAR(20) NULL;

    IF OBJECT_ID('dbo.processos_treinamentos', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.processos_treinamentos (
            id_processo_treinamento INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_processos_treinamentos PRIMARY KEY,
            id_processo NVARCHAR(80) NOT NULL,
            trilha_id INT NOT NULL,
            vagas_totais INT NOT NULL CONSTRAINT DF_processos_treinamentos_vagas_totais DEFAULT 0,
            vagas_liberadas INT NOT NULL CONSTRAINT DF_processos_treinamentos_vagas_liberadas DEFAULT 0,
            criado_em DATETIME NOT NULL CONSTRAINT DF_processos_treinamentos_criado_em DEFAULT GETDATE(),
            atualizado_em DATETIME NOT NULL CONSTRAINT DF_processos_treinamentos_atualizado_em DEFAULT GETDATE()
        );
    END;

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = 'IX_processos_treinamentos_id_processo'
          AND object_id = OBJECT_ID('dbo.processos_treinamentos')
    )
        CREATE INDEX IX_processos_treinamentos_id_processo ON dbo.processos_treinamentos(id_processo);

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
