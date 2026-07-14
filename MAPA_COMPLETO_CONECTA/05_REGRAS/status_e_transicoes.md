# Status e transicoes

## Status de processo

| Status | Significado | Proximo |
| --- | --- | --- |
| Aberto | processo ativo e movimentavel | Encerrado |
| Encerrado | processo fechado | reabertura nao observada |

## Status de candidato

| Status | Grupo | Significado | Acoes permitidas |
| --- | --- | --- | --- |
| Em analise / Analise | ativo | triagem inicial | qualificar, eliminar, banco |
| Qualificado | ativo | apto a seguir | agendar entrevista, prova, eliminar |
| Nao qualificado | terminal/triagem | nao recomendado automaticamente | banco ou encerramento |
| Pendente | entrevista | aguardando confirmacao | confirmar, reagendar, cancelar |
| Agendado | entrevista | entrevista marcada | confirmar, reagendar, cancelar |
| Confirmado | entrevista | presenca confirmada | compareceu/faltou |
| Reagendado | entrevista | nova data | confirmar/cancelar |
| Nao respondeu | entrevista | sem retorno | reagendar/eliminar |
| Cancelado | entrevista | entrevista cancelada | reagendar conforme regra |
| Compareceu | ativo/decisao | compareceu | aprovar, eliminar, banco |
| Faltou | entrevista | nao compareceu | reagendar/eliminar |
| Desistente | terminal | saiu do processo | bloqueia fluxo |
| Aprovado | terminal | aprovado | documentacao/comunicacao |
| Eliminado | terminal | eliminado | historico |
| Banco de Talentos | terminal/reaproveitamento | arquivado para futuro | usar em outro processo |

## Status de prova

| Status | Significado |
| --- | --- |
| Disponivel | prova gerada e aguardando acesso |
| Em andamento | candidato iniciou |
| Finalizada | prova concluida |
| Cancelada | prova invalidada/cancelada |

## Status de slot/entrevista

| Status | Significado |
| --- | --- |
| Disponivel | slot com vagas |
| Ocupado/Lotado | capacidade atingida |
| Pendente | entrevista aguardando |
| Agendado | entrevista marcada |
| Confirmado | confirmada |
| Cancelado | cancelada |

