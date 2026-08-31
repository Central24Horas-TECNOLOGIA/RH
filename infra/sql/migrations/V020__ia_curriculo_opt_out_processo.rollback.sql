/*
  Rollback de V020__ia_curriculo_opt_out_processo.sql.

  Remove a coluna apenas se nenhum processo tiver de fato marcado o opt-out
  -- se algum processo ja usa a flag para desabilitar a analise por IA, o
  DROP fica bloqueado para nao reabilitar a analise silenciosamente num
  processo que o RH marcou explicitamente como sensivel.
*/
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID('dbo.processos_seletivos', 'U') IS NOT NULL
   AND COL_LENGTH('dbo.processos_seletivos', 'ia_analise_desabilitada') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM dbo.processos_seletivos WHERE ia_analise_desabilitada = 1)
        THROW 50000, 'Existe processo com analise de curriculo por IA desabilitada: nao remova esta coluna sem decisao explicita.', 1;

    IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_processos_ia_analise_desabilitada')
        ALTER TABLE dbo.processos_seletivos DROP CONSTRAINT DF_processos_ia_analise_desabilitada;

    ALTER TABLE dbo.processos_seletivos DROP COLUMN ia_analise_desabilitada;
END;
