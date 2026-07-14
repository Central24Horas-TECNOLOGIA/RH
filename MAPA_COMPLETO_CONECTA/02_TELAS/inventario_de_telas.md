# Inventario de telas

| ID | Tela | Menu | Caminho | Objetivo | Perfil observado |
| --- | --- | --- | --- | --- | --- |
| T01 | Login | - | `#/login` | autenticar RH | publico interno |
| T02 | Inicio | Inicio | `#/inicio` | painel, atalhos, resumo | Administrador |
| T03 | Caixa de E-mail | E-mails | `#/caixa-email` | tratar curriculos recebidos | Administrador |
| T04 | Processos seletivos | Processos > Processos | `#/processos` | listar e acompanhar processos abertos | Administrador |
| T05 | Novo processo | botao Criar Processo | `#/novo-processo` | cadastrar vaga/processo | Administrador |
| T06 | Processos encerrados | Processos > Processos encerrados | `#/processos/encerrados` | consultar processos fechados | Administrador |
| T07 | Detalhes do processo | botao Detalhes | `#/detalhes-processo` | ver candidatos, dossie, entrevistas, provas, historico | Administrador |
| T08 | Provas e resultados | Processos > Provas e Resultados | `#/processos/provas-resultados` | acompanhar provas geradas e notas | Administrador |
| T09 | Historico de provas | alias/fluxo | `#/processos/historico-exames` | consultar provas finalizadas | Administrador |
| T10 | Entrevistas | Entrevistas | `#/processos/entrevistas-agendadas` | calendario, slots e agenda | Administrador |
| T11 | Banco de talentos | Banco de Talentos | `#/banco-talentos` | reaproveitar candidatos | Administrador |
| T12 | Analise de candidatos | Relatorios | `#/analise-candidatos` | indicadores e analise | Administrador |
| T13 | Central de candidatos | Relatorios > Candidatos | `#/candidatos` | ficha consolidada e filtros | Administrador |
| T14 | Pipeline de candidatos | busca/detalhes | `#/pipeline-candidatos` | funil por candidato/processo | Administrador |
| T15 | Detalhe do candidato | lista/busca | `#/candidatos/detalhes` | ficha individual | Administrador |
| T16 | Usuarios | Configuracoes | `#/configuracoes/usuario` | gerir usuarios | Administrador |
| T17 | Perfis e permissoes | Configuracoes | `#/configuracoes/perfis-permissoes` | matriz de acesso | Administrador |
| T18 | Regras reutilizaveis | Configuracoes | `#/configuracoes/regras-reutilizaveis` | catalogos, motivos, status, modelos | Administrador |
| T19 | Logs | Configuracoes | `#/configuracoes/logs` | auditoria e exportacao | Administrador |
| T20 | Configuracao da prova | acao Gerar prova | `#/configuracao` | parametros de prova | Administrador |
| T21 | Conecta Provas | externo | `#/conecta-provas` | acesso do candidato a prova | publico com codigo/token |
| T22 | Candidatura publica | externo | `#/candidatar/<slug>` | formulario publico da vaga | nao testado sem slug ativo |
| T23 | Acesso negado | fallback | `#/acesso-negado` | informar falta de permissao | qualquer autenticado |
| T24 | Resultado | fluxo contextual | `#/resultado` | mostrar resultado quando existe contexto | redirecionou para Inicio |

