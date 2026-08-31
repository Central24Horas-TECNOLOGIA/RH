/*
  Conecta RH - programa de evolucao pos-auditoria (docs/connecta-evolution/,
  achado SEC-011 / S-10): a analise de curriculo por IA (AI_ENABLED=true)
  envia dado sensivel do candidato a um provedor de IA sem contrato de
  retencao de dados (DPA) formalmente confirmado. Enquanto a negociacao do
  DPA nao e concluida (item de procurement/juridico, fora do escopo de
  codigo -- ver PAID_DEPENDENCIES.md), esta migration adiciona um opt-out
  granular por processo seletivo: o RH pode desabilitar a analise por IA
  especificamente nos processos que lidam com dado mais sensivel, sem
  precisar desligar o recurso inteiro no servidor (AI_ENABLED global).

  Estritamente aditiva:
  - Coluna BIT NOT NULL DEFAULT 0 -- nenhum processo existente muda de
    comportamento (analise por IA continua disponivel onde ja estava,
    condicionada a AI_ENABLED=true no servidor).
  - Nenhuma tabela ou coluna existente e removida/renomeada.

  Reflete o mesmo schema que rh_api/repositories/bootstrap.py
  (ensure_process_columns) cria automaticamente em DEV/HML -- mantenha os
  dois em sincronia caso este arquivo seja executado manualmente.
*/
SET XACT_ABORT ON;
SET NOCOUNT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID('dbo.processos_seletivos', 'U') IS NOT NULL
       AND COL_LENGTH('dbo.processos_seletivos', 'ia_analise_desabilitada') IS NULL
    BEGIN
        ALTER TABLE dbo.processos_seletivos
        ADD ia_analise_desabilitada BIT NOT NULL CONSTRAINT DF_processos_ia_analise_desabilitada DEFAULT 0;
    END;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
