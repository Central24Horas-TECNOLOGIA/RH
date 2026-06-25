# Relatório da entrega enterprise

Data: 24/06/2026.

## Árvore resultante

```text
apps/
  backend/
    src/conecta/
      domain/{candidatos,processos,provas,entrevistas,usuarios,permissoes,auditoria}
      application/{candidatos,processos,provas,entrevistas,auth,notificacoes,auditoria}
      infrastructure/{database/sqlserver,database/repositories,email,storage,security,observability}
      interfaces/http/{routes,schemas,middlewares}
      shared/
    tests/{unit,integration,e2e}
    Dockerfile
  frontend/
    src/{app,pages,components,modules,services,shared}
    Dockerfile
infra/
  caddy/ docker/ sql/ scripts/ maintenance/
docs/
  adr/ api/ arquitetura/ banco/ deploy/ runbooks/ seguranca/
.github/workflows/{ci.yml,security.yml}
```

## Principais arquivos criados

- Casos de uso e regras puras em `apps/backend/src/conecta`.
- TOTP, criptografia Fernet e rate limit em `infrastructure/security`.
- Middleware de contexto e adapters canônicos de HTTP/SQL Server.
- Limites modulares do frontend em `apps/frontend/src` e primitivas reais em
  `Front/fonte/ui/components/primitives.js`.
- Dockerfiles, três Compose, Caddyfile, Prometheus e modelos de ambiente.
- Migration RBAC/MFA, seed protegido, validação de ambiente, backup/restore e usuário
  SQL de privilégio mínimo.
- Workflows de CI e segurança, sete ADRs, runbook, matriz RBAC e checklist de release.

## Movimentações

Não houve movimentação física destrutiva de código funcional nesta etapa. Os destinos
canônicos foram introduzidos com adapters, e o mapa de movimentação por domínio está
em `plano-refatoracao-incremental.md`. Foram removidos somente artefatos reproduzíveis
indevidamente versionados: `.venv.zip` e `api/__pycache__/app.cpython-313.pyc`.

## Validações executadas

- 73 testes Python aprovados.
- Aplicação iniciada localmente; `/health`, `/version` e `runtime-config.js` responderam.
- Tela de login e campo MFA renderizados sem erro de console no navegador.
- Compose DEV, HML e PROD validados com `docker compose config`.
- `git diff --check` e busca local de segredos sem achados.

## Riscos e pendências

- O daemon Docker estava desligado; as imagens não foram construídas localmente. A CI
  contém o build obrigatório.
- Node não está instalado neste host; os smoke tests JS ficam obrigatórios na CI. O
  carregamento real do browser foi validado.
- Migration V001 ainda precisa ser aplicada e testada em `Conecta_DEV` e HML antes de PROD.
- `api/rh_api` e `Front/` continuam como adapters executáveis; removê-los agora quebraria
  compatibilidade. Migrar domínio por domínio e remover apenas após HML.
- O frontend ainda depende de CDNs públicas para React/HTM e bibliotecas de planilha;
  empacotar e fixar esses assets é recomendado para operação sem internet.
- O rate limit atual é por processo. Antes de múltiplas réplicas, implementar adapter
  distribuído gratuito/operacional (por exemplo, Redis já aprovado pela infraestrutura).

## Próximos passos

1. Subir Docker Desktop e executar os builds locais.
2. Aplicar V001 em DEV, testar ativação/login/reset MFA e promover para HML.
3. Migrar candidatos/processos, depois provas/entrevistas, conectando os casos de uso
   novos aos repositories atuais.
4. Ensaiar backup, deploy e rollback em HML.
5. Empacotar dependências CDN e adicionar métricas de latência/erro.
