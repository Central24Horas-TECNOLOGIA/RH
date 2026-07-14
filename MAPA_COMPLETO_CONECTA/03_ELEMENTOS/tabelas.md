# Tabelas

| Tela | Tabela | Colunas observadas | Observacao |
| --- | --- | --- | --- |
| Inicio | Caixa de e-mail resumida | Data, Assunto, Anexo/CV, Status | aparece dentro do painel |
| E-mails | Caixa completa | Data, Assunto, Nome, Experiencia, Contato detectado, Anexo/CV, Status | 10 itens retornados pela API |
| Processos | Listagem/gestao | processo, vaga, status, candidatos, acoes | parte em cards e parte em lista |
| Detalhes processo | Candidatos no processo | Candidato, Notas/aderencia, Status, Proxima acao | 1 linha ativa na amostra |
| Detalhes processo | Aprovados | Candidato, Nota final, Data de aprovacao, Status | 0 aprovados, mas tabela renderizou linha/estado |
| Detalhes processo | Reprovados | Candidato, Origem, Resultado, Motivo/analise, Status, Acao | 3 reprovados |
| Detalhes processo | Dossie | Candidato, Curriculo, Prova, Entrevista, Nota final, Status, Parecer, Decisao RH | 4 candidatos |
| Banco de talentos | Lista atual | Processo, Candidato, Cidade, Bairro, Vaga, Nota, Habilidades/Tags, Observacoes RH, Entrevista, CV, Acoes | 1 item |
| Provas e resultados | Lista de provas | Candidato, Vaga, Status, Data geracao, Nota final, Alertas, Acoes | 4 provas |
| Logs | Lista de logs | data, modulo, usuario, perfil, acao, entidade, criticidade, sucesso | renderizada como lista expansivel |
| Historico | Historico de provas | candidato, vaga, nivel, trilha, nota, status, data | 1 registro via API |

