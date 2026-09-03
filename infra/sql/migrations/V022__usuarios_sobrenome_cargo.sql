/*
  Conecta RH - Correcoes.txt (rodada de 02/set/2026): aba Configuracoes >
  Ambiente > Perfil ganha campos de Sobrenome e Cargo, ao lado do Nome que ja
  existia.

  Migracao estritamente aditiva e idempotente. Nenhuma coluna existente e
  alterada/removida. Reflete o mesmo schema que o bootstrap runtime
  (rh_api/repositories/bootstrap.py, ensure_bootstrap_tables) cria
  automaticamente; mantenha os dois em sincronia caso este arquivo seja
  executado manualmente.
*/
SET XACT_ABORT ON;
SET NOCOUNT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    IF COL_LENGTH('dbo.usuarios', 'sobrenome') IS NULL
        ALTER TABLE dbo.usuarios ADD sobrenome NVARCHAR(180) NULL;

    IF COL_LENGTH('dbo.usuarios', 'cargo') IS NULL
        ALTER TABLE dbo.usuarios ADD cargo NVARCHAR(180) NULL;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
