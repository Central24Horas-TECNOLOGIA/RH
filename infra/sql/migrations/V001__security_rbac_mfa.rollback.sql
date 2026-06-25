-- Rollback seguro: desativa MFA sem remover colunas nem dados auditáveis.
UPDATE dbo.usuarios SET mfa_enabled = 0 WHERE mfa_enabled = 1;
