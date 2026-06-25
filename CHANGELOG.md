# Changelog

Todas as mudanças relevantes seguem [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Adicionado

- Estrutura incremental de Clean Architecture em `apps/backend/conecta`.
- Frontend executável consolidado em `apps/frontend`.
- RBAC com perfis Administrador, RH, Gestor, DP, Estagiário e Candidato.
- Preparação completa de MFA TOTP com segredo criptografado e reset auditado.
- Rate limit de login, logs JSON e correlação por `request_id`.
- Endpoints `/health`, `/ready`, `/version` e `/metrics`.
- Dockerfiles, Compose DEV/HML/PROD, Caddy/TLS e migrations SQL.
- CI, verificações de segurança, ADRs e runbooks.

### Alterado

- O bootstrap administrativo não usa mais senha padrão conhecida.
- DEV/HML são bloqueados ao apontar para `Conecta_PROD`.

### Segurança

- Tokens permanecem em `sessionStorage`, não em `localStorage`.
- MFA exige `cryptography` e chave externa `RH_MFA_ENCRYPTION_KEY`.
