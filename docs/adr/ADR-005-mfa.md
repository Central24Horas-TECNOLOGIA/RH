# ADR-005 — MFA TOTP

**Status:** aceito em 24/06/2026.

TOTP usa o padrão RFC 6238 e aplicativos autenticadores gratuitos. O segredo é
criptografado com Fernet e chave externa ao banco/código. Ativação, falha e reset
administrativo geram auditoria.
