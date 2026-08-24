/*
  Conecta RH - roadmap de expansao (respostas.txt): raciocinio logico
  adaptativo (dentro da mesma aplicacao) e balanceamento de dificuldade
  por nivel de vaga.

  Migracao estritamente aditiva e idempotente. Nenhuma tabela ou coluna
  existente e alterada/removida. Reflete o mesmo schema que o bootstrap
  runtime (rh_api/repositories/bootstrap.py::ensure_raciocinio_tables)
  cria/altera automaticamente; mantenha os dois em sincronia caso este
  script seja executado manualmente.

  - modo_adaptativo: flag por aplicacao (default 0 = modo fixo, o
    comportamento existente nao muda sem opt-in explicito do RH).
  - nivel_vaga: nivel da vaga associado a essa aplicacao (estagiario /
    junior / pleno / senior), usado para balancear a composicao de
    dificuldade das questoes no modo fixo. NULL = comportamento atual
    (selecao aleatoria simples), sem alterar o fluxo de vagas sem nivel.
  - estado_adaptativo_json: estado interno (pool de questoes restantes +
    dificuldade atual) do modo adaptativo; nunca exposto ao candidato.
*/
SET XACT_ABORT ON;
SET NOCOUNT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID('dbo.raciocinio_aplicacoes', 'U') IS NOT NULL
    BEGIN
        IF COL_LENGTH('dbo.raciocinio_aplicacoes', 'modo_adaptativo') IS NULL
            ALTER TABLE dbo.raciocinio_aplicacoes
            ADD modo_adaptativo BIT NOT NULL CONSTRAINT DF_raciocinio_aplicacoes_modo_adaptativo DEFAULT 0;

        IF COL_LENGTH('dbo.raciocinio_aplicacoes', 'nivel_vaga') IS NULL
            ALTER TABLE dbo.raciocinio_aplicacoes ADD nivel_vaga NVARCHAR(20) NULL;

        IF COL_LENGTH('dbo.raciocinio_aplicacoes', 'estado_adaptativo_json') IS NULL
            ALTER TABLE dbo.raciocinio_aplicacoes ADD estado_adaptativo_json NVARCHAR(MAX) NULL;
    END

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
