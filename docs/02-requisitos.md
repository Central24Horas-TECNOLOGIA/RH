# 02 - Requisitos

## Requisitos funcionais

- O sistema deve permitir login por credencial local configurada em ambiente.
- O sistema deve validar sessao e bloquear rotas protegidas sem token.
- O sistema deve permitir configurar uma prova por processo, vaga, nivel, trilha e tempo.
- O sistema deve registrar historico de prova com identificador de teste, candidato, vaga, data, nota e resumo de etapas.
- O sistema deve persistir o payload de gabarito por `record_id`.
- O sistema deve listar historico com filtro por nome, vaga e data e opcionalmente paginacao.
- O sistema deve cadastrar processos seletivos com vagas, prazo, operacao, trilha, nota de corte e link de agendamento.
- O sistema deve atualizar e encerrar processos seletivos.
- O sistema deve vincular candidatos a processos seletivos.
- O sistema deve atualizar status do candidato no processo.
- O sistema deve recalcular vagas preenchidas ao aprovar ou desfazer aprovacao.
- O sistema deve enviar candidatos ao banco de talentos quando o status correspondente for aplicado.
- O sistema deve permitir reaproveitar candidatos do banco de talentos em outro processo.
- O sistema deve permitir cadastrar e manter tags, habilidades e observacoes do candidato.
- O sistema deve analisar CV enviado para um processo e classificar o candidato.
- O sistema deve permitir editar e excluir pre-analises de CV.
- O sistema deve permitir adicionar um CV aprovado diretamente ao processo.
- O sistema deve listar pipeline de candidatos por processo e busca textual.
- O sistema deve criar cards manuais no pipeline.
- O sistema deve mover cards entre etapas do pipeline.
- O sistema deve excluir cards do pipeline.
- O sistema deve agendar entrevistas para candidatos do processo.
- O sistema deve atualizar entrevista, status, link e observacoes.
- O sistema deve disponibilizar mensagem base de entrevista.
- O sistema deve listar entrevistas com filtros por processo, status e busca textual.
- O sistema deve consolidar analise de candidato com afinidade, recomendacao e parecer final.
- O sistema deve exibir tour guiado somente na primeira visita por tela e navegador.
- O sistema deve permitir reabrir o tour manualmente por meio do botao de ajuda.

## Requisitos nao funcionais

- O sistema deve operar localmente em ambiente Windows corporativo.
- O backend deve usar SQL Server com conexao confiavel e `TrustServerCertificate=yes`.
- O frontend deve funcionar em navegadores modernos com JavaScript habilitado.
- A navegacao deve ser hash-based para evitar build complexo e facilitar operacao local.
- A interface deve ser responsiva e usavel em notebook sem depender de zoom do navegador.
- O tratamento de erro da API deve retornar JSON consistente com `success` e `message`.
- O sistema deve registrar logs de backend em stdout.
- O sistema deve evitar operacoes DDL em rotas de leitura frequentes.
- O sistema deve tratar deadlock SQL Server de modo controlado, sem loop infinito.
- O sistema deve manter integracao entre prova, processo, pipeline, entrevista e banco de talentos.
- O sistema deve usar persistencia leve do tour no navegador com `localStorage`.
- O sistema deve preservar compatibilidade com o schema legado existente.
- O sistema deve permitir manutencao incremental sem troca de stack.
