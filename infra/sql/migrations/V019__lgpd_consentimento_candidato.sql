/*
  Conecta RH - programa de evolucao pos-auditoria (docs/connecta-evolution/,
  achado SEC-003): a candidatura publica exige aceite do termo LGPD, mas o
  aceite nunca era persistido (nem data, nem versao do termo, nem IP).

  Esta migration adiciona as 3 colunas de consentimento e mais 1 coluna de
  controle de anonimizacao (lgpd_anonimizado_em, usada pela rota real de
  anonimizacao/exclusao implementada atras da permissao ja existente
  candidatos.anonimizar/lgpd.anonimizar) em dbo.candidatos_metadata.
  Estritamente aditiva:

  - Colunas NULL por padrao -- nenhum registro existente e alterado.
  - Nenhuma tabela ou coluna existente e removida/renomeada.
  - Candidatos ja cadastrados antes desta correcao continuam com consentimento
    NULL ate a proxima interacao deles com o fluxo publico -- nao e retroativo
    (nao ha como reconstruir consentimento que nunca foi de fato capturado).

  Reflete o mesmo schema que rh_api/repositories/bootstrap.py
  (ensure_candidate_metadata_columns) cria automaticamente em DEV/HML --
  mantenha os dois em sincronia caso este arquivo seja executado manualmente.
*/
SET XACT_ABORT ON;
SET NOCOUNT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID('dbo.candidatos_metadata', 'U') IS NOT NULL
    BEGIN
        IF COL_LENGTH('dbo.candidatos_metadata', 'lgpd_consentimento_aceito_em') IS NULL
            ALTER TABLE dbo.candidatos_metadata ADD lgpd_consentimento_aceito_em DATETIME NULL;

        IF COL_LENGTH('dbo.candidatos_metadata', 'lgpd_consentimento_versao') IS NULL
            ALTER TABLE dbo.candidatos_metadata ADD lgpd_consentimento_versao NVARCHAR(40) NULL;

        IF COL_LENGTH('dbo.candidatos_metadata', 'lgpd_consentimento_ip') IS NULL
            ALTER TABLE dbo.candidatos_metadata ADD lgpd_consentimento_ip NVARCHAR(64) NULL;

        IF COL_LENGTH('dbo.candidatos_metadata', 'lgpd_anonimizado_em') IS NULL
            ALTER TABLE dbo.candidatos_metadata ADD lgpd_anonimizado_em DATETIME NULL;
    END;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
