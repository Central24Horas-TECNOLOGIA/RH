/*
  Rollback de V022__usuarios_sobrenome_cargo.sql.

  Remove as colunas "sobrenome" e "cargo" apenas se existirem.
*/
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF COL_LENGTH('dbo.usuarios', 'sobrenome') IS NOT NULL
    ALTER TABLE dbo.usuarios DROP COLUMN sobrenome;

IF COL_LENGTH('dbo.usuarios', 'cargo') IS NOT NULL
    ALTER TABLE dbo.usuarios DROP COLUMN cargo;
