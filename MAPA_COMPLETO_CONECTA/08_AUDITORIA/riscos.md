# Riscos

| Risco | Impacto | Mitigacao |
| --- | --- | --- |
| Alterar status errado de candidato | Alto | confirmacao com resumo e reversao |
| Excluir e-mail/anexo indevidamente | Alto | soft delete, restaurar, confirmacao |
| Encerrar processo antes da hora | Alto | bloquear se houver pendencias |
| Permissao mal configurada | Alto | matriz comparativa, log e revisao |
| Prova cancelada/reaberta sem contexto | Alto | motivo obrigatorio em modal |
| Dado de candidato duplicado | Medio | regra de duplicidade por e-mail/telefone |
| Link publico indisponivel | Medio | status visivel e validacao |
| Relatorio/exportacao com dados pessoais | Alto | permissao e registro LGPD |

