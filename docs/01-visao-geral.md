# 01 — Visão geral do Conecta C24h

## Finalidade do sistema

O Conecta C24h é uma aplicação web interna para apoiar o RH na triagem, acompanhamento e avaliação de candidatos. Ele centraliza tarefas que antes ficariam espalhadas entre planilhas, e-mails, arquivos locais e controles manuais.

O sistema cobre o ciclo operacional de recrutamento:

1. Recebimento de currículos pela caixa de e-mail.
2. Pré-análise de CV e extração de dados do candidato.
3. Criação e gestão de processos seletivos.
4. Vinculação de candidatos a processos.
5. Aplicação de prova/teste interno.
6. Acompanhamento de status do candidato.
7. Agendamento e controle de entrevistas por slots.
8. Aprovação, eliminação ou envio para banco de talentos.
9. Relatórios de processos e candidatos.

## Principais módulos identificados

| Módulo | Função prática | Onde aparece |
| --- | --- | --- |
| Login/autenticação | Restringe o acesso interno do RH | Tela de login e validações admin |
| Painel inicial | Resumo de processos, últimos testes e caixa de currículos | Tela `Painel` |
| Caixa de e-mail | Lista e-mails recebidos, permite analisar CV, vincular a processo, banco de talentos, ignorar ou excluir | Menu `E-mails` e painel inicial |
| Processos seletivos | Criação, edição, encerramento, detalhes e candidatos vinculados | Menu `Processos` |
| Candidatos | Gestão de candidatos e perfis | Menu `Candidatos` |
| Prova | Fluxo de avaliação, pontuação, histórico e resultado | Botão `Nova prova` e fluxo de prova |
| Entrevistas | Cadastro de slots e agendamento de candidato | Menu `Entrevistas` e detalhes do processo |
| Banco de talentos | Reaproveitamento de candidatos fora de processos ativos | Menu `Banco de talentos` |
| Análise/relatórios | Métricas e relatórios por processo e candidato | Menu `Análise` |

## Natureza técnica

O projeto é uma aplicação local/interna, sem etapa obrigatória de build no frontend. O backend roda em Python com FastAPI e a persistência é feita em SQL Server via `pyodbc`.

| Camada | Tecnologia/abordagem |
| --- | --- |
| Frontend | HTML, CSS, JavaScript modular ESM, React/HTM em runtime |
| Backend | Python, FastAPI, Pydantic, Uvicorn |
| Banco | SQL Server / SQL Server Express via ODBC |
| Integração e-mail | Microsoft 365 via IMAP/OAuth2 e/ou Graph conforme configuração |
| Arquivos CV | PDF, DOCX, DOC, RTF, ODT, TXT, com extração de texto e anexos locais |
| Testes | Pytest com fake repositories, quando dependências estão instaladas |

## Tamanho aproximado analisado

| Extensão | Qtd. arquivos | KB aprox. |
| --- | --- | --- |
| .py | 55 | 656.4 |
| .js | 113 | 10228.3 |
| .css | 6 | 64.4 |
| .html | 2 | 1.2 |
| .md | 27 | 488.5 |
| .ts | 6 | 22.0 |
| .xlsx | 5 | 3662.9 |
| .pdf | 5 | 111.6 |
| .docx | 3 | 101.4 |
| .doc | 1 | 88.0 |


## Diagnóstico objetivo

O projeto já está bem mais estruturado do que um protótipo simples. Existe separação clara em frontend, API, schemas, services e repositories. Também há testes e documentação legada. O ponto de atenção é que o sistema carrega bastante regra de negócio no frontend, principalmente nas telas de gestão/processos/prova, então mudanças visuais precisam ser feitas com cuidado para não quebrar comportamento.

Outro ponto importante: há duplicidade histórica de caminhos (`Front/fonte/...` e `fonte/...`). A pasta `Front/` aparenta ser a frente ativa carregada pelo `Front/index.html`; a pasta `fonte/` na raiz parece cópia/espelho legado e deve ser tratada com cautela antes de editar.
