/*
  Conecta RH - roadmap de expansao (respostas.txt, rodada de 25/ago/2026):
    Entidade "Operacao" (celula/produto de call center, ex: CRF, Davita).

  Reaproveita o mesmo shape das tabelas de catalogo reutilizavel (ver
  dbo.trilhas, dbo.motivos_eliminacao etc. e a funcao generica
  ensure_reusable_config_tables em rh_api/repositories/bootstrap.py), para
  que a tela de Configuracoes existente (aba "Catalogos" / CRUD generico)
  funcione sem router/repository dedicado.

  Semeia as operacoes que hoje estao hardcoded em
  apps/frontend/fonte/perguntas.js (OPERATION_OPTIONS) para que processos e
  provas ja existentes, que referenciam esses nomes como texto livre,
  continuem casando com os registros reais assim que o front passar a ler a
  lista pela API em vez do array estatico.

  Migracao estritamente aditiva e idempotente. Nenhuma tabela ou coluna
  existente e alterada/removida. Este script reflete o mesmo schema que o
  bootstrap runtime cria automaticamente para qualquer catalogo novo
  registrado em SETTINGS_CATALOGS; mantenha os dois em sincronia caso este
  arquivo seja executado manualmente.
*/
SET XACT_ABORT ON;
SET NOCOUNT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID('dbo.operacoes', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.operacoes (
            id_item INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_operacoes PRIMARY KEY,
            chave NVARCHAR(120) NULL,
            nome NVARCHAR(180) NOT NULL,
            descricao NVARCHAR(MAX) NULL,
            categoria NVARCHAR(120) NULL,
            payload_json NVARCHAR(MAX) NULL,
            ativo BIT NOT NULL CONSTRAINT DF_operacoes_ativo DEFAULT 1,
            usado BIT NOT NULL CONSTRAINT DF_operacoes_usado DEFAULT 0,
            criado_em DATETIME NOT NULL CONSTRAINT DF_operacoes_criado_em DEFAULT GETDATE(),
            atualizado_em DATETIME NOT NULL CONSTRAINT DF_operacoes_atualizado_em DEFAULT GETDATE()
        );
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.operacoes WHERE nome = N'CRF / Flamengo')
        INSERT INTO dbo.operacoes (chave, nome, descricao, categoria, payload_json, ativo, usado)
        VALUES (N'CRF', N'CRF / Flamengo', NULL, N'Receptivo', N'{}', 1, 1);

    IF NOT EXISTS (SELECT 1 FROM dbo.operacoes WHERE nome = N'Davita')
        INSERT INTO dbo.operacoes (chave, nome, descricao, categoria, payload_json, ativo, usado)
        VALUES (N'DAVITA', N'Davita', NULL, N'Receptivo', N'{}', 1, 1);

    IF NOT EXISTS (SELECT 1 FROM dbo.operacoes WHERE nome = N'Endoview')
        INSERT INTO dbo.operacoes (chave, nome, descricao, categoria, payload_json, ativo, usado)
        VALUES (N'ENDOVIEW', N'Endoview', NULL, N'Receptivo', N'{}', 1, 1);

    IF NOT EXISTS (SELECT 1 FROM dbo.operacoes WHERE nome = N'Newe Seguros')
        INSERT INTO dbo.operacoes (chave, nome, descricao, categoria, payload_json, ativo, usado)
        VALUES (N'NEWE', N'Newe Seguros', NULL, N'Receptivo', N'{}', 1, 1);

    IF NOT EXISTS (SELECT 1 FROM dbo.operacoes WHERE nome = N'Central24Horas')
        INSERT INTO dbo.operacoes (chave, nome, descricao, categoria, payload_json, ativo, usado)
        VALUES (N'C24H', N'Central24Horas', NULL, N'Administrativo', N'{}', 1, 1);

    IF NOT EXISTS (SELECT 1 FROM dbo.operacoes WHERE nome = N'Brava')
        INSERT INTO dbo.operacoes (chave, nome, descricao, categoria, payload_json, ativo, usado)
        VALUES (N'BRAVA', N'Brava', NULL, N'Receptivo', N'{}', 1, 1);

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
