# Matriz mínima de permissões

| Perfil | Escopo padrão |
| --- | --- |
| Administrador | Todas as permissões e administração de segurança |
| RH | Operação completa de candidatos, processos, provas e entrevistas |
| Gestor | Visão, avaliação e decisão final, sem administração global |
| DP | Fluxos operacionais e documentação admissional |
| Estagiário | Operação básica, sem ações administrativas críticas |
| Candidato | Somente os próprios fluxos públicos/de prova |

A fonte executável é `apps/backend/rh_api/rbac.py`. Alterações devem passar pelo endpoint
protegido de perfis/permissões e gerar log de auditoria.
