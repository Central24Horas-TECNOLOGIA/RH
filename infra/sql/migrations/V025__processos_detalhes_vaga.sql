/*
  Conecta RH - Correcoes.txt (rodada de 03/set/2026): criacao de processo
  seletivo ganha um conjunto grande de campos novos (tipo de contratacao,
  modelo/jornada de trabalho, requisitos do candidato, salario, beneficios,
  descricao de atividades, compartilhamento em redes sociais e treinamentos
  selecionados).

  Em vez de uma coluna por campo, este payload fica em um unico JSON
  (detalhes_vaga_json), no mesmo padrao ja usado por
  dbo.processos_seletivos.configuracao_prova_json (V005) para a configuracao
  da prova. Mantem o schema aditivo e evita uma migracao com dezenas de
  colunas para um formulario que ainda pode evoluir.

  Migracao estritamente aditiva e idempotente. Nenhuma coluna existente e
  alterada/removida. Reflete o mesmo schema que o bootstrap runtime
  (rh_api/repositories/bootstrap.py, ensure_process_columns) cria
  automaticamente; mantenha os dois em sincronia caso este arquivo seja
  executado manualmente.
*/
SET XACT_ABORT ON;
SET NOCOUNT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    IF COL_LENGTH('dbo.processos_seletivos', 'detalhes_vaga_json') IS NULL
        ALTER TABLE dbo.processos_seletivos ADD detalhes_vaga_json NVARCHAR(MAX) NULL;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
