/*
  Conecta RH - roadmap de expansao (Prompt.txt, rodada de 27/ago/2026): nova
  etapa de "Disponibilidade de horarios" na criacao de processo seletivo.

  Adiciona suporte a slots de entrevista "somente dia" (sem faixa de horario
  definida), para o caso do RH ainda nao saber os horarios exatos e querer
  apenas reservar o(s) dia(s) disponiveis. Quando somente_dia = 1, inicio/fim
  guardam o dia inteiro (00:00 a 23:59:59) apenas como referencia de data; a
  hora efetiva da entrevista e combinada depois pelo RH.

  Migracao estritamente aditiva e idempotente. Nenhuma tabela ou coluna
  existente e alterada/removida. Reflete o mesmo schema que o bootstrap
  runtime (rh_api/repositories/bootstrap.py, ensure_interview_slots_table)
  cria automaticamente; mantenha os dois em sincronia caso este arquivo seja
  executado manualmente.
*/
SET XACT_ABORT ON;
SET NOCOUNT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    IF COL_LENGTH('dbo.entrevista_slots', 'somente_dia') IS NULL
        ALTER TABLE dbo.entrevista_slots ADD somente_dia BIT NOT NULL CONSTRAINT DF_entrevista_slots_somente_dia DEFAULT 0;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
