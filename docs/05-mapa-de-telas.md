# Documentação Conecta C24h - RH

> Gerado a partir da análise do pacote `RH(20).zip`. Esta documentação descreve o sistema existente, seus fluxos, telas, APIs, banco, código, testes, operação e manual do usuário.


## Rotas do frontend

| Tela interna | Rota/hash |
|---|---|
| `screen-login` | `#/login` |
| `screen-menu` | `#/inicio` |
| `screen-email-inbox` | `#/caixa-email` |
| `screen-history` | `#/historico` |
| `screen-processes` | `#/processos` |
| `screen-candidates` | `#/candidatos` |
| `screen-candidate-pipeline` | `#/pipeline-candidatos` |
| `screen-process-create` | `#/novo-processo` |
| `screen-process-details` | `#/detalhes-processo` |
| `screen-interviews` | `#/entrevistas` |
| `screen-talent-bank` | `#/banco-talentos` |
| `screen-config` | `#/configuracao` |
| `screen-candidate` | `#/candidato` |
| `screen-exam` | `#/prova` |
| `screen-thanks` | `#/conclusao` |
| `screen-result` | `#/resultado` |
| `screen-analysis-candidates` | `#/analise-candidatos` |
| `screen-public-candidacy` | `#/candidatar` |

## Menu lateral

| Item | Tela | Objetivo |
|---|---|---|
| Painel | `screen-menu` | Entrada principal e atalhos. |
| E-mails | `screen-email-inbox` | Currículos recebidos por e-mail. |
| Histórico | `screen-history` | Provas e resultados. |
| Processos | `screen-processes` | Gestão de processos seletivos. |
| Candidatos | `screen-candidates` | Gestão central de candidatos. |
| Entrevistas | `screen-interviews` | Agenda e slots. |
| Análise | `screen-analysis-candidates` | Pré-análise de CVs/candidatos. |
| Banco de talentos | `screen-talent-bank` | Candidatos reaproveitáveis. |

## Descrição das telas

### Login
Entrada protegida do RH.

### Painel
Resumo operacional e atalhos para novo processo/nova prova.

### Caixa de e-mails
Lista mensagens, abre detalhes, baixa anexos, analisa CV, vincula ao processo, envia ao banco, ignora ou exclui.

### Histórico
Consulta provas finalizadas, resultados e arquivos de resposta.

### Processos
Lista processos, abre detalhe, encerra, gera link público e acompanha candidatos.

### Novo processo
Formulário de abertura de processo com vaga, operação/trilha, datas e observações.

### Candidatos
Visão central para status, aprovação, eliminação, banco de talentos e ações relacionadas.

### Entrevistas
Criação de slots, agendamento, atualização de status e observações.

### Análise
Pré-análise de currículos com score, classificação, dados extraídos e decisão do RH.

### Banco de talentos
Lista candidatos disponíveis para reaproveitamento em processos futuros.

### Prova
Fluxo do candidato: dados, execução, conclusão e resultado.

### Candidatura pública
Rota `#/candidatar/{slug}`, usada por candidatos externos para enviar dados e currículo.
