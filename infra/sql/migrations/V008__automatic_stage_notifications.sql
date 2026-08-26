/*
  Conecta RH - roadmap de expansao (respostas.txt): e-mails automaticos por
  etapa do candidato.

  Migracao estritamente aditiva e idempotente. Nenhuma tabela ou coluna
  existente e alterada/removida. Este script reflete o mesmo schema que o
  bootstrap runtime (rh_api/repositories/bootstrap.py) cria automaticamente;
  mantenha os dois em sincronia caso este arquivo seja executado manualmente.

  Tabela de configuracao (linha unica) para o RH ligar/desligar a automacao.
  Default desligado: a automacao so entra em vigor se o RH optar por ativa-la
  explicitamente, para nao surpreender ninguem com envio automatico de e-mail
  assim que esta mudanca subir.
*/
SET XACT_ABORT ON;
SET NOCOUNT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID('dbo.configuracoes_notificacoes_automaticas', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.configuracoes_notificacoes_automaticas (
            id_configuracao INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_configuracoes_notificacoes_automaticas PRIMARY KEY,
            email_automatico_ativo BIT NOT NULL CONSTRAINT DF_configuracoes_notificacoes_email_ativo DEFAULT 0,
            atualizado_por NVARCHAR(180) NULL,
            atualizado_em DATETIME NOT NULL CONSTRAINT DF_configuracoes_notificacoes_atualizado DEFAULT GETDATE()
        );
    END;

    IF COL_LENGTH('dbo.configuracoes_notificacoes_automaticas', 'email_automatico_ativo') IS NULL
        ALTER TABLE dbo.configuracoes_notificacoes_automaticas
        ADD email_automatico_ativo BIT NOT NULL CONSTRAINT DF_configuracoes_notificacoes_email_ativo2 DEFAULT 0;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
