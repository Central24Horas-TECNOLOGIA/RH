# Plano de refatoração incremental

## Estado após a consolidação

- entrada HTTP: `apps/backend/conecta/interfaces/http/main.py`;
- implementação funcional: `apps/backend/rh_api/`;
- arquitetura de destino: `apps/backend/conecta/`;
- frontend executável: `apps/frontend/index.html` e `apps/frontend/fonte/`.

A consolidação de diretórios terminou. O trabalho restante é arquitetural e deve
ser feito por domínio, sem recriar `api/`, `Front/` ou `fonte/` na raiz.

## Estratégia do backend

| Origem compatível | Destino canônico |
| --- | --- |
| `apps/backend/rh_api/services/*` | `apps/backend/conecta/application/<dominio>/*` |
| `apps/backend/rh_api/repositories/*` | `apps/backend/conecta/infrastructure/database/repositories/*` |
| `apps/backend/rh_api/db.py` | `apps/backend/conecta/infrastructure/database/sqlserver/connection.py` |
| autenticação e RBAC | `apps/backend/conecta/infrastructure/security` e `domain/permissoes` |
| `apps/backend/rh_api/routers/*` | `apps/backend/conecta/interfaces/http/routes/*` |
| `apps/backend/rh_api/schemas/*` | `apps/backend/conecta/interfaces/http/schemas/*` |

Cada extração deve preservar os contratos HTTP e passar pela suíte completa antes
que o módulo compatível correspondente seja retirado.

## Estratégia do frontend

O frontend permanece estático e sem build obrigatório. Refatorações devem ocorrer
dentro de `apps/frontend/fonte/`, preservando URLs, imports ESM, fluxo de prova e
contratos com a API. Não criar uma segunda árvore `src/` sem uma decisão
arquitetural explícita.

## Critérios de saída

1. `python -m pytest` aprovado;
2. smoke tests JavaScript aprovados;
3. `/health`, `/ready`, `/version` e `/docs` respondendo;
4. login e fluxos de processo, candidato, prova e entrevista validados;
5. nenhuma importação do domínio migrado apontando para o pacote compatível.
