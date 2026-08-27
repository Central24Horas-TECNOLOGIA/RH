/*
  Conecta RH - roadmap de expansao (respostas.txt): "Motivo de eliminacao
  estruturado com sub-causa".

  Adiciona uma coluna de sub-causa ao lado do motivo de eliminacao ja
  existente (candidatos_processos.motivo_eliminacao), para que o RH possa
  detalhar o motivo principal com uma sub-causa mais especifica (ex.: motivo
  "Nao compareceu" -> sub-causa "Nao atendeu ligacao"). As sub-causas
  disponiveis por motivo sao cadastradas no catalogo reutilizavel
  motivos_eliminacao (aba Catalogos em Configuracoes), no mesmo payload_json
  generico ja usado por outros catalogos.

  Migracao estritamente aditiva e idempotente. Nenhuma tabela ou coluna
  existente e alterada/removida. Reflete o mesmo schema que o bootstrap
  runtime (rh_api/repositories/bootstrap.py, ensure_candidate_approval_columns)
  cria automaticamente; mantenha os dois em sincronia caso este arquivo seja
  executado manualmente.
*/
SET XACT_ABORT ON;
SET NOCOUNT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    IF COL_LENGTH('dbo.candidatos_processos', 'sub_causa_eliminacao') IS NULL
        ALTER TABLE dbo.candidatos_processos ADD sub_causa_eliminacao NVARCHAR(180) NULL;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
