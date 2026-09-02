/*
  Conecta RH - Correcoes.txt (rodada de 02/set/2026): indicador de lido/nao
  lido para os itens da Cx de Curriculos (ex-Caixa de E-mail).

  Guarda apenas um flag local (nao existe conceito de "lido" no IMAP em si -
  o parametro unread_only da listagem usa a flag nativa UNSEEN, que e outra
  coisa). Novos itens entram como nao lidos (0); marcar como lido acontece ao
  abrir o detalhe do item.

  Migracao estritamente aditiva e idempotente. Reflete o mesmo schema que o
  bootstrap runtime (rh_api/repositories/bootstrap.py,
  ensure_email_inbox_items_table) cria automaticamente; mantenha os dois em
  sincronia caso este arquivo seja executado manualmente.
*/
SET XACT_ABORT ON;
SET NOCOUNT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID('dbo.email_inbox_items', 'U') IS NOT NULL
       AND COL_LENGTH('dbo.email_inbox_items', 'lido') IS NULL
        ALTER TABLE dbo.email_inbox_items ADD lido BIT NULL;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
