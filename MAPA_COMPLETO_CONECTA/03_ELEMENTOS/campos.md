# Campos

| Tela | Secao | Campo | Tipo | Obrigatorio | Objetivo | Problema / sugestao |
| --- | --- | --- | --- | --- | --- | --- |
| Login | Acesso | Login | texto/e-mail | sim operacional | identificar usuario | placeholder claro |
| Login | Acesso | Senha | senha | sim operacional | autenticar | ok |
| Inicio | Topbar | Buscar candidatos, processos, vagas ou provas | busca | nao | busca global | manter escopo visivel |
| Inicio/E-mails | Caixa | Mostrar ignorados/excluidos | checkbox | nao | incluir itens ocultos | bom, mas impacto deve ser explicado |
| E-mails | Filtros | Filtrar por assunto, nome, experiencia ou contato | busca | nao | localizar e-mail/candidato | ok |
| E-mails | Tabela | Selecionar e-mails desta pagina | checkbox | nao | acao em lote | exigir feedback de selecao |
| Novo processo | Dados | Vaga do processo | select | sim operacional | definir vaga | marcar obrigatoriedade |
| Novo processo | Dados | Quantidade de vagas | numero | sim operacional | dimensionar vaga | validar minimo 1 |
| Novo processo | Dados | Data de encerramento | data | sim operacional | prazo | validar data futura |
| Novo processo | Dados | Operacao / Cliente | select | sim operacional | contexto da vaga | ok |
| Novo processo | Dados | Area / Trilha | select | sim operacional | trilha de avaliacao | ok |
| Novo processo | Criterios | Ativar nota de corte | checkbox | nao | habilitar regra de eliminacao automatica | explicar impacto |
| Novo processo | Criterios | Nota minima | numero | condicional | nota de corte | desabilitado ate ativar checkbox |
| Detalhes processo | Filtros | Busca | texto | nao | filtrar candidatos | label generico "search" em alguns pontos |
| Detalhes processo | Filtros | Filtrar status | select | nao | reduzir lista | ok |
| Detalhes processo | Filtros | Ordenar por | select | nao | ordenar candidatos | ok |
| Detalhes processo | Filtros | Exibir | select | nao | com/sem prova | ok |
| Entrevistas | Criar disponibilidade | Processo | select | sim operacional | associar slot | quando geral, limita agenda por processo |
| Entrevistas | Criar disponibilidade | Data | data | sim operacional | dia do slot | validar futuro |
| Entrevistas | Criar disponibilidade | Inicio | hora | sim operacional | inicio da janela | validar menor que fim |
| Entrevistas | Criar disponibilidade | Fim | hora | sim operacional | fim da janela | validar maior que inicio |
| Entrevistas | Criar disponibilidade | Duracao (min) | numero | sim operacional | granularidade | validar divisibilidade |
| Entrevistas | Criar disponibilidade | Capacidade por slot | numero | sim operacional | limite de vagas | validar minimo |
| Entrevistas | Filtros | Status | select | nao | filtrar agenda | status completos |
| Provas | Filtros | Candidato/e-mail/codigo | texto | nao | localizar prova | ok |
| Provas | Filtros | Vaga | select | nao | filtrar por vaga | ok |
| Provas | Filtros | Status | select | nao | filtrar prova | padronizar cores |
| Provas | Filtros | Resultado | select | nao | com nota/alerta | ok |
| Provas | Filtros | Data | data | nao | periodo | ok |
| Banco | Filtros | Nome/vaga/processo | texto | nao | localizar candidato | ok |
| Banco | Filtros | Habilidade | texto | nao | buscar skill | ok |
| Banco | Filtros | Tag | texto | nao | buscar tag | ok |
| Candidatos | Filtros | Busca geral | texto | nao | localizar pessoa | ok |
| Candidatos | Filtros | Status | select | nao | status consolidado | agrupa "Em processo" |
| Candidatos | Filtros | Origem | select | nao | origem do candidato | ok |
| Usuarios | Filtros | Busca | texto | nao | nome/e-mail/login | ok |
| Usuarios | Filtros | Status | select | nao | ativo/inativo/bloqueado | ok |
| Usuarios | Filtros | Perfil | select | nao | filtrar perfil | ok |
| Usuarios | Formulario | Nome | texto | sim | dados do usuario | ok |
| Usuarios | Formulario | E-mail | e-mail | sim | contato/login | ok |
| Usuarios | Formulario | Login | texto | nao | identificador | placeholder explica fallback |
| Usuarios | Formulario | Perfil | select | sim operacional | permissao | alteracao sensivel |
| Usuarios | Formulario | Status | select | sim operacional | acesso | alteracao sensivel |
| Usuarios | Formulario | Nova senha | senha | condicional | redefinicao | exige justificativa recomendada |
| Usuarios | Formulario | Justificativa | textarea | recomendado | auditoria | tornar obrigatoria para criticos |
| Regras | Formulario | Nome | texto | sim | item de catalogo | ok |
| Regras | Formulario | Chave | texto | nao | identificador | orientar formato |
| Regras | Formulario | Criticidade | select | nao | prioridade | ok |
| Regras | Formulario | Tags | texto | nao | categorizacao | explicar separador |
| Logs | Filtros | Busca | texto | nao | texto livre | ok |
| Logs | Filtros | Modulo | select | nao | filtrar modulo | duplicidade Autenticacao/Autenticacao com acento |
| Logs | Filtros | Acao | select | nao | filtrar evento | nomes tecnicos |
| Logs | Filtros | Usuario | texto | nao | autor | ok |
| Logs | Filtros | Criticidade | select | nao | operacional/critica/falha | ok |
| Conecta Provas | Acesso | codigo/token | texto | sim | acessar prova | label visual ausente na captura |

