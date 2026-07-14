# Dependencias

| Funcao | Depende de | Se ausente |
| --- | --- | --- |
| Abrir detalhe de processo | processo selecionado em contexto | rota pode ficar vazia/redirecionar |
| Ficha do candidato | candidato selecionado | tela contextual sem dados |
| Agendar entrevista | candidato qualificado + slot | acao bloqueada/sem slot |
| Prova | candidato/processo/configuracao | nao gera corretamente |
| Candidatura publica | slug ativo | rota nao testavel |
| Banco de talentos | candidato salvo | lista vazia |
| Exportar logs | permissao `logs.exportar` | botao bloqueado |
| Editar perfil/permissoes | permissao administrativa | tela bloqueada |
| Nota de corte | checkbox ativo | nota minima desabilitada |
| Reabrir/cancelar prova | motivo | prompt/modal |

