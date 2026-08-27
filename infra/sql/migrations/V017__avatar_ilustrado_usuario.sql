/*
  Conecta RH - roadmap de expansao (Prompt.txt, rodada de 27/ago/2026): opcao
  de configurar um avatar ilustrado como foto de perfil (aba Configuracoes >
  Ambiente).

  Guarda apenas o identificador do avatar escolhido (ex.: "avatar-07"), que o
  frontend resolve para um arquivo estatico em
  apps/frontend/estilos/avatares/. Usuario sem avatar escolhido (NULL)
  continua caindo no fallback de iniciais ja existente.

  Migracao estritamente aditiva e idempotente. Nenhuma tabela ou coluna
  existente e alterada/removida. Reflete o mesmo schema que o bootstrap
  runtime (rh_api/repositories/bootstrap.py, ensure_bootstrap_tables) cria
  automaticamente; mantenha os dois em sincronia caso este arquivo seja
  executado manualmente.
*/
SET XACT_ABORT ON;
SET NOCOUNT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    IF COL_LENGTH('dbo.usuarios', 'avatar_ilustrado') IS NULL
        ALTER TABLE dbo.usuarios ADD avatar_ilustrado NVARCHAR(60) NULL;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
