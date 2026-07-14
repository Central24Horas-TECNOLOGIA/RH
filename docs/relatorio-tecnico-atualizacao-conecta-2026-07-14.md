# Relatório técnico - Atualização Conecta

Data: 2026-07-14

## Arquivos alterados

- `apps/frontend/fonte/services/api/core.js`: cache central com TTL maior, limite de itens em memória, limpeza de expirados e utilitário de atualização.
- `apps/frontend/fonte/services/api/processes.js`: cache para e-mails, detalhes/anotações de processo e novas APIs de pausar, retomar e cancelar processo.
- `apps/frontend/fonte/services/api/analytics.js`: cache para relatórios e análises.
- `apps/frontend/fonte/rotas.js`: rotas limpas com compatibilidade para hashes antigos.
- `apps/frontend/fonte/app/controlador-aplicacao.js`: navegação por History API e exports das novas APIs.
- `apps/frontend/fonte/app/aplicacao-raiz.js`: remoção da tela ativa de Regras reutilizáveis.
- `apps/frontend/fonte/ui/components/layout.js`: remoção do menu Regras reutilizáveis e renomeação do grupo para Recrutamento > Processos Seletivos.
- `apps/frontend/fonte/features/configuracoes/index.js`: remoção da aba Regras reutilizáveis.
- `apps/frontend/fonte/ui/busca-global.js`: label acessível e remoção da referência à funcionalidade removida.
- `apps/frontend/fonte/ui/components/modals.js`: criação do `ModalConfirmacaoAcao` com justificativa, estado de loading e tratamento de erro.
- `apps/frontend/fonte/ui/componentes-compartilhados.js`: export do novo modal.
- `apps/frontend/fonte/features/provas-geradas/index.js`: substituição de prompts nativos de cancelamento/reabertura por `ModalConfirmacaoAcao`.
- `apps/frontend/fonte/features/processos/index.js`: ações pausar/retomar/cancelar processo, modais para ações sensíveis, fluxo “Adicionar candidato” para Central de Candidatos e estado vazio de aprovados.
- `apps/frontend/fonte/shared/process-flow.js`: status `Pausado` e `Cancelado`.
- `apps/frontend/fonte/servico-api.js`: exports das novas APIs.
- `apps/backend/rh_api/services/process_flow.py`: status de processo próprios.
- `apps/backend/rh_api/schemas/processes.py`: schema de justificativa obrigatória.
- `apps/backend/rh_api/repositories/bootstrap.py`: colunas de status e tabela de alertas de inatividade.
- `apps/backend/rh_api/repositories/processes.py`: alteração de status e monitor de inatividade de 30 dias.
- `apps/backend/rh_api/routers/processes.py`: rotas `/pause`, `/resume`, `/cancel` e `/processes/inactivity-alerts/run`.
- `apps/backend/rh_api/repositories/security.py`: normalização de módulo de log `Autenticação`.
- `apps/backend/rh_api/routers/auth.py`: logout com módulo `Autenticação`.
- `apps/backend/rh_api/rbac.py`: remoção da tela legada `screen-settings-rules`.

## Arquivos criados

- `apps/frontend/fonte/shared/status-catalog.js`: catálogo central inicial de status.
- `infra/sql/migrations/V003__process_status_and_inactivity_alerts.sql`: migration de status/alertas.
- `docs/relatorio-tecnico-atualizacao-conecta-2026-07-14.md`.
- `docs/checklist-atualizacao-conecta-2026-07-14.md`.

## Arquivos removidos

- Nenhum arquivo físico removido. A funcionalidade Regras reutilizáveis foi removida de rota ativa, menu, aba e RBAC de tela; estruturas de catálogo compartilhadas foram preservadas por segurança.

## Rotas alteradas

- Frontend passou de hash para History API: `/login`, `/inicio`, `/processos`, `/caixa-email`, etc.
- Links legados `#/...` são normalizados para rota limpa.
- `configuracoes/regras-reutilizaveis` redireciona de forma compatível para `screen-settings-users`.

## APIs alteradas

- `POST /processes/{id_processo}/pause`
- `POST /processes/{id_processo}/resume`
- `POST /processes/{id_processo}/cancel`
- `POST /processes/inactivity-alerts/run`

## Banco e migrations

- Novas colunas em `processos_seletivos`: `status_anterior`, `status_operacional_anterior`, `justificativa_status`, `status_alterado_por`, `status_alterado_em`, `ultima_movimentacao_relevante_em`, `ultimo_alerta_inatividade_em`.
- Nova tabela `processos_alertas_inatividade`.
- Migration: `V003__process_status_and_inactivity_alerts.sql`.

## Cache

- Cache central reforçado com TTL, limite de 80 itens, limpeza de expirados e invalidação seletiva.
- Cache aplicado a processos, candidatos, banco de talentos, e-mails, detalhes/anotações de processo, provas geradas e relatórios.
- Mutations relevantes invalidam caches relacionados.

## Novas regras de negócio

- Pausar processo exige justificativa e bloqueia movimentações operacionais.
- Retomar processo exige justificativa e reinicia movimentação relevante.
- Cancelar processo exige justificativa, não exclui dados e bloqueia novas movimentações.
- Processos pausados/cancelados/encerrados não entram em alerta de inatividade.
- Monitor de 30 dias cria alerta interno idempotente; e-mail fica marcado como pendente de configuração externa.

## Status

- Processo: `Aberto`, `Pausado`, `Cancelado`, `Encerrado`.
- Catálogo central inicial criado em `status-catalog.js`.

## Menu e permissões

- Grupo “Processos” renomeado para “Recrutamento”.
- Subitem “Processos” renomeado para “Processos Seletivos”.
- “Regras reutilizáveis” removido do menu, aba e mapa de tela RBAC.

## Logs

- Ações de pausar/retomar/cancelar geram auditoria com valor anterior, valor novo e justificativa.
- Módulo `Autenticacao` é exibido como `Autenticação`.

## Testes realizados

- `node --check` em arquivos JS alterados principais: aprovado.
- `ast.parse` em arquivos Python alterados principais: aprovado.
- `.venv\Scripts\python.exe -m pytest apps\backend\tests\test_history_and_process_rules.py apps\backend\tests\test_auth_and_pipeline.py apps\backend\tests\test_email_inbox_service.py`: 25 passed.
- `run-rh-business-rules-smoke.cjs`: passed.
- `run-refresh-performance-smoke.cjs`: passed.
- `run-process-details-rules-smoke.cjs`: passed.

## Limitações e pontos externos

- Envio real de e-mail de alerta de 30 dias depende de configuração SMTP/Graph e job externo chamando `/processes/inactivity-alerts/run`.
- Ainda existem `window.alert`/`window.confirm` em áreas não migradas fora dos prompts de prova removidos nesta entrega.
- Responsividade ampla, reorganização total de entrevistas/configurações e auditoria de todos os campos da plataforma não foram validadas visualmente em navegador nesta rodada.
