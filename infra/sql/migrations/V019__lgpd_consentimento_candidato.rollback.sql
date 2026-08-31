/*
  Rollback de V019__lgpd_consentimento_candidato.sql.

  Remove as 3 colunas apenas se nenhum consentimento real foi gravado ainda
  -- se ja existir consentimento capturado, o DROP fica bloqueado para nao
  destruir evidencia de conformidade sem decisao explicita.
*/
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID('dbo.candidatos_metadata', 'U') IS NOT NULL
   AND COL_LENGTH('dbo.candidatos_metadata', 'lgpd_consentimento_aceito_em') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM dbo.candidatos_metadata WHERE lgpd_consentimento_aceito_em IS NOT NULL)
        THROW 50000, 'candidatos_metadata tem consentimento LGPD gravado: nao remova estas colunas sem decisao explicita.', 1;

    ALTER TABLE dbo.candidatos_metadata DROP COLUMN lgpd_consentimento_aceito_em;
    ALTER TABLE dbo.candidatos_metadata DROP COLUMN lgpd_consentimento_versao;
    ALTER TABLE dbo.candidatos_metadata DROP COLUMN lgpd_consentimento_ip;
    IF COL_LENGTH('dbo.candidatos_metadata', 'lgpd_anonimizado_em') IS NOT NULL
        ALTER TABLE dbo.candidatos_metadata DROP COLUMN lgpd_anonimizado_em;
END;
