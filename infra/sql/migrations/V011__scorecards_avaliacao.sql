/*
  Conecta RH - roadmap de expansao (respostas.txt): Kanban de vagas com
  scorecard.

  Migracao estritamente aditiva e idempotente. Nenhuma tabela ou coluna
  existente e alterada/removida. Este script reflete o mesmo schema que o
  bootstrap runtime (rh_api/repositories/bootstrap.py::ensure_scorecards_table)
  cria automaticamente; mantenha os dois em sincronia caso este arquivo seja
  executado manualmente.

  Cada linha representa a nota (1 a 5) de UM criterio de avaliacao para um
  candidato em uma etapa do funil de selecao. Varias linhas com o mesmo
  candidato_processo_id + etapa_avaliada compoem o scorecard daquela etapa
  (ex.: "Comunicacao", "Fit tecnico", "Experiencia relevante" - criterios
  padrao da v1, fixos por enquanto).
*/
SET XACT_ABORT ON;
SET NOCOUNT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID('dbo.scorecards_avaliacao', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.scorecards_avaliacao (
            id INT IDENTITY(1,1) PRIMARY KEY,
            candidato_processo_id INT NOT NULL,
            etapa_avaliada NVARCHAR(60) NULL,
            criterio NVARCHAR(120) NOT NULL,
            nota INT NOT NULL,
            comentario NVARCHAR(MAX) NULL,
            avaliado_por NVARCHAR(180) NULL,
            avaliado_em DATETIME NOT NULL CONSTRAINT DF_scorecards_avaliado_em DEFAULT GETDATE()
        );
    END

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = 'IX_scorecards_avaliacao_candidato'
          AND object_id = OBJECT_ID('dbo.scorecards_avaliacao')
    )
    BEGIN
        CREATE INDEX IX_scorecards_avaliacao_candidato
        ON dbo.scorecards_avaliacao (candidato_processo_id, etapa_avaliada);
    END

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
