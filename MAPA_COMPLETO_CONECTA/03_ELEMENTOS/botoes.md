# Botoes e acoes

| Tela | Botao/acao | Icone | Local | Funcao | Impacto | Teste |
| --- | --- | --- | --- | --- | --- | --- |
| Layout | Voltar ao painel principal | logo | menu | ir ao Inicio | navegacao | funciona |
| Layout | Recolher/Expandir | chevron | menu | alternar menu | altera layout | funciona |
| Layout | Ver orientacoes | help | topbar | abrir tour | modal informativo | funciona parcialmente, tour abriu |
| Layout | Sair | logout | topbar | encerrar sessao | logout | nao executado no fim |
| Layout | Perfil do usuario | avatar | topbar | abrir dropdown | mostra configuracoes/sair | observado |
| Inicio | Atualizar | refresh | card e-mail | recarregar dados | consulta | observado |
| Inicio | Nova vaga | work | atalhos | abrir novo processo | navegacao | observado |
| Inicio | Agendar entrevista | calendar_month | atalhos | abrir entrevistas | navegacao | observado |
| Inicio | Caixa de Email | send | atalhos | abrir caixa | navegacao | observado |
| Inicio | Relatorios | bar_chart | atalhos | abrir relatorios | navegacao | observado |
| Inicio | Configuracoes | more_horiz | atalhos | abrir configuracoes | navegacao | observado |
| E-mails | Filtrar | filter_alt | toolbar | aplicar filtros | consulta | observado |
| E-mails | Abrir detalhes | texto/icone | linha | modal de e-mail | leitura | documentado |
| E-mails | Analisar CV | texto | linha | extrair/classificar CV | altera analise/dados | nao executado |
| E-mails | Vincular a processo | texto | linha | incluir candidato | altera processo | nao executado |
| E-mails | Banco de Talentos | texto | linha | enviar candidato ao banco | altera banco | nao executado |
| E-mails | Ignorar | texto | linha | ocultar e-mail | altera status | nao executado |
| E-mails | Excluir | texto | linha | remover e-mail | destrutivo | nao executado |
| Processos | Criar Processo | add | topo | abrir cadastro | navegacao | funciona |
| Processos | Filtrar | filter_alt | filtros | aplicar filtros | consulta | observado |
| Processos | Ver Detalhes / Detalhes | arrow | card/linha | abrir detalhe | navegacao | funciona |
| Processos | Mais acoes | more_horiz | linha | abrir menu secundario | acoes contextuais | observado |
| Novo processo | Voltar | arrow_back | topo | retornar | navegacao | nao executado |
| Novo processo | Cancelar | - | rodape | sair sem salvar | descarta edicao | nao executado |
| Novo processo | Proximo passo | arrow_forward | rodape | avancar wizard | validacao | nao executado |
| Detalhe processo | Compartilhar vaga | share | cabecalho | link publico | pode gerar/mostrar link | nao executado |
| Detalhe processo | Ver resumo da vaga | assignment | cabecalho | alternar painel | leitura | observado |
| Detalhe processo | Adicionar candidato | person_add | aba candidatos | abrir formulario | cria vinculo se salvo | nao salvo |
| Detalhe processo | Encontrar candidatos | - | abas | buscar candidatos | consulta | observado |
| Detalhe processo | Salvar parecer | - | dossie | registrar observacao | altera dossie | nao executado |
| Candidatos | Atualizar | - | topo/lista | recarregar | consulta | observado |
| Candidatos | Editar | icone | ficha | abrir edicao | altera ficha se salvo | nao salvo |
| Candidatos | Baixar ficha | - | ficha | download | arquivo | nao executado |
| Candidatos | Analisar CV | - | ficha | analise IA | altera analise | nao executado |
| Banco | Perfil RH | - | linha | abrir/editar perfil | leitura/edicao | observado |
| Banco | Eliminar | - | linha | eliminar candidato | status final | nao executado |
| Banco | Utilizar | - | linha | vincular a processo | altera processo | nao executado |
| Entrevistas | Gerar slots | calendar_add_on | formulario | criar disponibilidades | cria slots | nao executado |
| Entrevistas | Aplicar | filter_alt | filtros | filtrar agenda | consulta | observado |
| Entrevistas | Limpar | refresh | filtros | limpar filtros | consulta | observado |
| Provas | Gerar prova | assignment_add | topo | abrir criacao | cria prova se salvo | nao executado |
| Provas | Detalhes | visibility | linha | abrir detalhe | leitura | observado |
| Provas | Cancelar/Reabrir | prompt | linha | mudar status | alto impacto | nao executado |
| Config Usuarios | Novo usuario | person_add | topo | iniciar cadastro | cria se salvo | nao salvo |
| Config Usuarios | Salvar | check | formulario | salvar usuario | altera acesso | nao executado |
| Config Usuarios | Desativar | person_remove | formulario | desativar | bloqueia acesso | nao executado |
| Config Perfis | Gerenciar permissoes | admin_panel_settings | tela | editar matriz | altera permissao | nao executado |
| Config Regras | Novo item | add | catalogo | limpar/iniciar item | cria se salvo | observado |
| Config Regras | Salvar | check | formulario | salvar catalogo | altera regra | nao executado |
| Config Regras | Arquivar | delete | item | desativar item | altera catalogo | nao executado |
| Config Logs | Exportar | download | topo | baixar logs | arquivo | nao executado |
| Config Logs | Expandir log | expand_more | lista | ver detalhes | leitura | observado |
| Conecta Provas | Continuar | - | centro | validar codigo | pode iniciar prova | nao executado |

