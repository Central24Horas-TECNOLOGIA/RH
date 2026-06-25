SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH('dbo.usuarios', 'mfa_enabled') IS NULL
    ALTER TABLE dbo.usuarios ADD mfa_enabled BIT NOT NULL CONSTRAINT DF_usuarios_mfa_enabled DEFAULT 0;

IF COL_LENGTH('dbo.usuarios', 'mfa_secret_encrypted') IS NULL
    ALTER TABLE dbo.usuarios ADD mfa_secret_encrypted NVARCHAR(1000) NULL;

IF NOT EXISTS (SELECT 1 FROM dbo.perfis WHERE id_perfil = 'rh')
    INSERT INTO dbo.perfis (id_perfil, nome, nivel, descricao, ativo, sistema, criado_em, atualizado_em)
    VALUES ('rh', 'RH', 'Avançado', 'Operação completa de recrutamento e seleção.', 1, 1, GETDATE(), GETDATE());

IF NOT EXISTS (SELECT 1 FROM dbo.perfis WHERE id_perfil = 'candidato')
    INSERT INTO dbo.perfis (id_perfil, nome, nivel, descricao, ativo, sistema, criado_em, atualizado_em)
    VALUES ('candidato', 'Candidato', 'Portal', 'Acesso aos próprios fluxos.', 1, 1, GETDATE(), GETDATE());

COMMIT TRANSACTION;
