# Documentação Conecta C24h - RH

> Gerado a partir da análise do pacote `RH(20).zip`. Esta documentação descreve o sistema existente, seus fluxos, telas, APIs, banco, código, testes, operação e manual do usuário.


## Nome do sistema

**Conecta C24h - RH**.

## Objetivo

Centralizar o processo de recrutamento e seleção da Central 24h, cobrindo abertura de processos, candidatos, provas, análise de currículos, caixa de e-mails, banco de talentos, entrevistas, histórico e relatórios.

## Problema resolvido

O sistema reduz controles espalhados entre e-mails, planilhas, arquivos locais e mensagens. Ele cria uma trilha única para o RH acompanhar origem, status, prova, movimentações e decisões sobre cada candidato.

## Público-alvo

| Perfil | Uso |
|---|---|
| RH/Recrutamento | Operar processos, candidatos, CVs, entrevistas e relatórios. |
| Supervisão/Liderança | Acompanhar candidatos e decisões quando aplicável. |
| Suporte/TI | Manter API, banco, frontend, logs e ambiente. |
| Candidato | Enviar candidatura pública e realizar prova. |

## Módulos

| Módulo | Finalidade |
|---|---|
| Login | Autenticação administrativa. |
| Painel | Entrada principal e atalhos. |
| Caixa de e-mails | Organização dos currículos recebidos por e-mail. |
| Processos | Cadastro, acompanhamento e encerramento de processos. |
| Candidatos | Gestão central dos candidatos e movimentações. |
| Candidatura pública | Link público com envio de currículo. |
| Análise de CV | Extração de dados, score e classificação. |
| Banco de talentos | Reaproveitamento de candidatos. |
| Entrevistas | Slots, agendamentos e status. |
| Provas | Aplicação e cálculo de resultado. |
| Histórico | Consulta de provas e arquivos de resposta. |
| Relatórios | Visões analíticas e exportação. |

## Stack técnica

| Camada | Tecnologia |
|---|---|
| Frontend | HTML, CSS, JavaScript ESM, React via HTM, navegação por hash. |
| Backend | Python, FastAPI, Pydantic, pyodbc. |
| Banco | SQL Server/SQL Server Express. |
| Testes | Pytest com fake repository. |
| Arquivos | Pastas locais para CVs, anexos e planilhas de exame. |
