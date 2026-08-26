/*
  Conecta RH - roadmap de expansao (respostas.txt): Botao Expresso (contratacao
  urgente).

  Migracao estritamente aditiva e idempotente. Nenhuma tabela ou coluna
  existente e alterada/removida. Este script reflete o mesmo schema que o
  bootstrap runtime (rh_api/repositories/bootstrap.py) cria automaticamente;
  mantenha os dois em sincronia caso este arquivo seja executado manualmente.
*/
SET XACT_ABORT ON;
SET NOCOUNT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    -- Sinaliza vaga/processo como "Botao Expresso" (contratacao urgente).
    IF COL_LENGTH('dbo.processos_seletivos', 'urgente') IS NULL
        ALTER TABLE dbo.processos_seletivos ADD urgente BIT NOT NULL CONSTRAINT DF_processos_urgente DEFAULT 0;

    IF COL_LENGTH('dbo.processos_seletivos', 'urgente_marcado_em') IS NULL
        ALTER TABLE dbo.processos_seletivos ADD urgente_marcado_em DATETIME NULL;

    IF COL_LENGTH('dbo.processos_seletivos', 'urgente_marcado_por') IS NULL
        ALTER TABLE dbo.processos_seletivos ADD urgente_marcado_por NVARCHAR(180) NULL;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
