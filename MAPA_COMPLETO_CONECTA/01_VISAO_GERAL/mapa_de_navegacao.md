# Mapa de navegacao

## Menu lateral observado

| Grupo | Item | Rota | Permissao visivel |
| --- | --- | --- | --- |
| Principal | Inicio | `#/inicio` | autenticado |
| Principal | E-mails | `#/caixa-email` | candidatos.criar |
| Processos | Processos | `#/processos` | vagas.visualizar |
| Processos | Processos encerrados | `#/processos/encerrados` | vagas.visualizar |
| Processos | Provas e Resultados | `#/processos/provas-resultados` | provas.visualizar |
| Principal | Entrevistas | `#/processos/entrevistas-agendadas` | entrevistas.visualizar |
| Principal | Banco de Talentos | `#/banco-talentos` | candidatos.visualizar |
| Relatorios | Analise de candidatos | `#/analise-candidatos` | relatorios.visualizar |
| Relatorios | Candidatos | `#/candidatos` | candidatos.visualizar |
| Configuracoes | Usuarios | `#/configuracoes/usuario` | usuarios.visualizar |
| Configuracoes | Perfis e permissoes | `#/configuracoes/perfis-permissoes` | configuracoes.visualizar |
| Configuracoes | Regras reutilizaveis | `#/configuracoes/regras-reutilizaveis` | configuracoes.visualizar |
| Configuracoes | Logs | `#/configuracoes/logs` | logs.visualizar |

## Rotas e aliases

| Rota | Tela real observada | Observacao |
| --- | --- | --- |
| `#/login` | Login | entrada interna |
| `#/inicio` | Inicio | painel |
| `#/processos/visao-geral` | Processos | alias |
| `#/processos/abertos` | Processos | alias |
| `#/historico` | Historico de provas | alias |
| `#/historico-exames` | Historico de provas | alias |
| `#/provas-resultados` | Provas e resultados | alias |
| `#/entrevistas` | Entrevistas | alias |
| `#/configuracoes` | Usuarios | alias |
| `#/configuracao` | Configuracao da prova | fluxo antigo/operacional |
| `#/candidato` | Redirecionou para configuracao da prova | rota legada/contextual |
| `#/prova` | Redirecionou para configuracao da prova | rota legada/contextual |
| `#/resultado` | Redirecionou para inicio | depende de contexto |
| `#/conecta-provas` | Portal publico de prova | sem login interno |
| `#/acesso-negado` | Acesso negado | fallback de permissao |

## Pontos confusos

- Existem rotas legadas de prova/candidato que levam para a configuracao, o que pode confundir auditoria e suporte.
- O menu recolhido em celular ocupa 88px de largura, reduzindo a area util.
- A busca global e alguns placeholders aparecem como campos tecnicos no inventario; precisam de rotulo mais claro para acessibilidade.

