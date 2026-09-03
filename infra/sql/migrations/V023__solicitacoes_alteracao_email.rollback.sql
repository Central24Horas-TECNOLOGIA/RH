/*
  Rollback de V023__solicitacoes_alteracao_email.sql.

  Remove a tabela apenas se existir.
*/
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID('dbo.solicitacoes_alteracao_email', 'U') IS NOT NULL
    DROP TABLE dbo.solicitacoes_alteracao_email;
