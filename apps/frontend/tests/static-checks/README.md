# Checagens estáticas (não são testes de comportamento)

Os scripts `.cjs` desta pasta **não renderizam a aplicação nem simulam interação de usuário**. Cada um lê o código-fonte de um ou mais arquivos de `fonte/` como texto e verifica, com `assert`, que trechos-chave (uma string, uma regra, o nome de uma função, um padrão de import) ainda existem — ou continuam ausentes, quando o objetivo é garantir que algo removido não volte.

## Por que existem

São uma rede de segurança rápida (sem browser, sem servidor, roda em milissegundos) contra a forma mais comum de regressão nesta base de código: um refactor apaga ou renomeia sem querer uma string, uma condição de negócio ou uma chamada de função que uma tela depende — sem gerar erro de sintaxe, porque JS não tem tipo estático que pegaria isso.

## O que eles **não** verificam

Comportamento real: não confirmam que a tela renderiza corretamente, que um clique dispara a ação esperada, ou que o dado exibido está correto. Para esse tipo de garantia, a cobertura real do projeto é a suíte Playwright em [`../../tests-e2e/`](../../tests-e2e/), que abre a aplicação de verdade num navegador.

## Origem (achado S-25 do programa de evolução do Conecta)

Uma auditoria classificou os 6 scripts de `apps/frontend/tests/` como "regressão por checagem de string" e recomendou substituí-los por testes reais ou reclassificá-los. Ao revisar os 6:

- **4 são checagens estáticas de fato** (os desta pasta) — reclassificados aqui, com esta documentação, em vez de reescritos como testes de comportamento que este ambiente não tem como executar/verificar com segurança.
- **2 já eram testes reais** (`run-excel-correction-smoke.cjs` e `run-rh-business-rules-smoke.cjs`, que permanecem em `apps/frontend/tests/`) — carregam o módulo de origem de verdade (`fonte/regras-prova.js`, `fonte/perguntas.js`, etc.) e executam a lógica de negócio contra dados de fixture, com asserções sobre o resultado — a classificação original da auditoria era imprecisa para esses dois.

## Como executar

```powershell
node apps/frontend/tests/static-checks/run-process-details-rules-smoke.cjs
node apps/frontend/tests/static-checks/run-exam-analytics-smoke.cjs
node apps/frontend/tests/static-checks/run-refresh-performance-smoke.cjs
node apps/frontend/tests/static-checks/run-conecta-provas-flow-smoke.cjs
```

Todos rodam no CI (`.github/workflows/ci.yml`).
