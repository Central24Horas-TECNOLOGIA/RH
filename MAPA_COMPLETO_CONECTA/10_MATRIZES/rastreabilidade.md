# Matriz de rastreabilidade

| Tela | Elemento | Acao | Regra | Informacao | Destino | Impacto |
| --- | --- | --- | --- | --- | --- | --- |
| Novo processo | Proximo passo/Salvar | criar processo | dados obrigatorios | vaga, vagas, data, operacao | Processos | novo fluxo |
| E-mails | Analisar CV | analisar | CV valido | anexo/dados detectados | Analise/Ficha | triagem |
| E-mails | Vincular | incluir candidato | processo aberto | candidato/processo | Detalhe processo | cria vinculo |
| E-mails | Banco de Talentos | arquivar | candidato valido | contato/CV | Banco | reaproveitamento |
| Detalhe | Agendar | entrevista | qualificado + slot | candidato/slot | Entrevistas | muda status |
| Detalhe | Aprovar | decisao | permissao + confirmacao | documentos/mensagem | Historico | status final |
| Detalhe | Eliminar | decisao | motivo obrigatorio | motivo/etapa | Historico | status final |
| Detalhe | Salvar parecer | registrar | texto | observacao RH | Dossie | auditoria operacional |
| Provas | Gerar prova | criar | candidato elegivel | vaga/nivel/trilha | Conecta Provas | prova disponivel |
| Provas | Cancelar | cancelar | motivo | prova | Provas | bloqueia acesso |
| Banco | Utilizar | vincular | processo aberto | candidato | Processo | reentrada |
| Usuarios | Salvar | alterar usuario | justificativa sensivel | perfil/status | Acesso | muda permissoes |
| Perfis | Gerenciar permissoes | alterar matriz | admin | permissoes | Menu/Botoes | muda visibilidade |
| Logs | Exportar | baixar | permissao | logs filtrados | arquivo | auditoria |

