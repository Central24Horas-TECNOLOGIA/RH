# Relacionamento entre modulos

| Origem | Acao | Destino | Informacao enviada | Resultado |
| --- | --- | --- | --- | --- |
| E-mails | Analisar CV | Analise de curriculo | anexo, remetente, corpo, dados detectados | score/classificacao e dados sugeridos |
| E-mails | Vincular a processo | Processos | candidato extraido + processo | candidato aparece no detalhe do processo |
| E-mails | Banco de Talentos | Banco de talentos | candidato e contato | candidato fica reaproveitavel |
| Processos | Adicionar candidato | Candidatos no processo | dados pessoais e processo | novo vinculo operacional |
| Processos | Agendar entrevista | Entrevistas | candidato, processo, slot | entrevista marcada e status atualizado |
| Entrevistas | Gerar slots | Slots | processo, data, inicio/fim, duracao, capacidade | disponibilidades no calendario |
| Processos | Gerar prova | Provas e Resultados | candidato, vaga, nivel, trilha | prova disponivel com codigo/link |
| Conecta Provas | Finalizar prova | Historico / resultado | respostas, tempo, nota | registro de prova finalizada |
| Candidatos | Editar ficha | Ficha do candidato | contato, endereco, observacoes, tags | dados refletidos nas listagens |
| Candidatos | Aprovar | Processo / historico | decisao, documentos, mensagem | status final aprovado |
| Candidatos | Eliminar | Processo / historico | motivo, etapa | status final eliminado |
| Banco de Talentos | Utilizar | Processos | candidato + processo aberto | candidato retorna ao fluxo |
| Configuracoes | Alterar perfil | Permissoes e menu | perfil/permissoes | muda visibilidade de telas e acoes |
| Configuracoes | Exportar logs | Auditoria | filtros | arquivo de logs |

## Dados compartilhados

- Nome, e-mail, telefone, WhatsApp, cidade e bairro aparecem em e-mails, ficha, candidato, banco e processo.
- Status do candidato aparece em processos, candidatos, entrevistas, banco e relatorios.
- Vaga/processo aparece em quase todas as telas operacionais.
- Tags, habilidades e observacoes RH conectam ficha, banco e candidatos.
- Logs refletem login, exportacao, criacao, atualizacao e negacoes.

