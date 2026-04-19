# 13 - Changelog

## v1.1.0 - 2026-04-19

### Correcoes

- Removida a execucao de garantia de schema em rotas quentes de leitura de detalhe de processo e entrevistas.
- Centralizado o bootstrap de schema complementar na inicializacao da API.
- Adicionado retry baixo e controlado para deadlock SQL Server.
- Padronizado o retorno de erro de banco para o frontend.

### Melhorias

- Incluido tour guiado por pagina com persistencia por navegador/usuario.
- Adicionado botao manual para reabrir orientacoes.
- Ajustada densidade visual global para uso mais confortavel em notebook.
- Organizada documentacao completa em `docs/`.

### Impacto funcional preservado

- Login mantido.
- Dashboard mantido.
- Historico mantido.
- Processos seletivos mantidos.
- Provas mantidas.
- Pipeline mantido.
- Banco de talentos mantido.
- Entrevistas mantidas.
- Analise de candidatos mantida.

## v1.0.0 - baseline anterior ao versionamento formal

### Baseline funcional

- Frontend hash-based.
- API FastAPI integrada ao SQL Server.
- Historico de provas.
- Cadastro de processos.
- Vinculo de candidatos ao processo.
- Pipeline operacional.
- Banco de talentos.
- Agenda de entrevistas.
- Analise de candidatos.

## Politica sugerida de versionamento

- `MAJOR`: quebraria contrato ou exigiria migracao relevante.
- `MINOR`: novas capacidades integradas sem quebra.
- `PATCH`: correcoes e ajustes internos.
