/*
  Rollback de V021__email_inbox_lido.sql.

  Remove a coluna "lido" apenas se existir.
*/
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID('dbo.email_inbox_items', 'U') IS NOT NULL
   AND COL_LENGTH('dbo.email_inbox_items', 'lido') IS NOT NULL
    ALTER TABLE dbo.email_inbox_items DROP COLUMN lido;
