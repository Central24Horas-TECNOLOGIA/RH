/*
  Rollback operacional seguro do modulo analitico.
  Os dados sao preservados para auditoria; apenas trabalhos ainda executaveis
  sao cancelados. Remocao fisica exige procedimento separado e backup validado.
*/
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID('dbo.analise_jobs_provas', 'U') IS NOT NULL
BEGIN
    UPDATE dbo.analise_jobs_provas
    SET status_job = N'Cancelado',
        bloqueado_por = NULL,
        bloqueado_em = NULL,
        atualizado_em = SYSUTCDATETIME(),
        finalizado_em = COALESCE(finalizado_em, SYSUTCDATETIME())
    WHERE status_job IN (N'Pendente', N'Processando', N'Falhou');
END;
