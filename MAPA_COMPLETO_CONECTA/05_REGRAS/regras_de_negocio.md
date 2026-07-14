# Regras de negocio

| Regra | Condicao | Acao | Resultado | Impacto | Problema identificado |
| --- | --- | --- | --- | --- | --- |
| Login obrigatorio | usuario acessa area interna | autenticar | libera menu por permissao | seguranca | ok |
| Permissao por tela | perfil sem permissao | bloquear/redirecionar | acesso negado | seguranca | mensagens genericas |
| Processo aberto | status Aberto | permite movimentacao | candidatos e etapas ativos | operacao | ok |
| Processo encerrado | status Encerrado | bloquear novas movimentacoes | evita erro operacional | alto | confirmar bloqueios em todos botoes |
| Nota de corte | checkbox ativo | exigir nota minima | classifica abaixo do corte | alto | explicar impacto ao RH |
| Candidato qualificado | status Qualificado | permite agendamento | entrevista possivel | medio | ok |
| Candidato terminal | aprovado/eliminado/banco/desistente | bloquear acoes de fluxo ativo | finaliza participacao | alto | garantir retorno/reversao |
| Eliminacao | acao Eliminar | exigir motivo | status Eliminado | alto | motivo deve ser obrigatorio |
| Eliminacao por entrevista | motivo entrevista | exigir etapa | historico coerente | medio | campo condicional ok |
| Aprovacao | acao Aprovar | revisar mensagem/documentos | status Aprovado | alto | exigir confirmacao |
| Banco de talentos | enviar banco | guardar candidato | reaproveitamento | medio | distinguir de eliminacao |
| Usar banco | candidato em banco + processo aberto | vincular | volta ao processo | medio | evitar duplicidade |
| Slot | data/hora/capacidade | gerar disponibilidade | horarios | medio | validar conflitos |
| Capacidade slot | ocupados >= capacidade | bloquear agendamento | evita excesso | alto | precisa feedback claro |
| Entrevista | agendar candidato | criar entrevista | status pendente/agendado | medio | ok |
| Reagendamento | entrevista existente | escolher novo slot | status Reagendado | medio | nao testado |
| Prova gerada | candidato/processo | gerar codigo/link | prova Disponivel | alto | evitar duplicidade |
| Cancelar prova | prova ativa | informar motivo | status Cancelada | alto | prompt nativo inconsistente |
| Reabrir prova | prova cancelada | motivo | status disponivel | alto | prompt nativo inconsistente |
| Resultado | prova finalizada | gravar nota/status | historico | alto | resultado exige contexto |
| E-mail ignorado | item selecionado | ocultar | sai da rotina normal | medio | checkbox para ver ocultos |
| E-mail excluido | item selecionado | remover | some da lista | alto | nao testado |
| Analise CV | anexo disponivel | extrair dados | classificacao/score | medio | RH deve revisar |
| Usuario ativo | status Ativo | permite acesso | login possivel | alto | ok |
| Usuario bloqueado | status Bloqueado | impede acesso | seguranca | alto | nao testado |
| Perfil | permissoes alteradas | muda visibilidade | menu/botoes mudam | alto | requer auditoria |
| Logs | acao critica | registrar evento | rastreabilidade | alto | ok |
| Catalogo ativo | item ativo | aparece nos fluxos | padronizacao | medio | muitos vazios na amostra |
| Link publico candidatura | slug ativo | publicar vaga | entrada externa | medio | nao havia link ativo |
| Busca global | termo digitado | navegar para objeto | atalho | baixo | precisa resultado claro |
| Tour | primeira visita/ajuda | abrir modal | orientacao | baixo | pode aparecer em contexto de auditoria |

