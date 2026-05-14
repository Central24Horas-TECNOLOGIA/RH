# 04 — Regras de negócio

## Processo seletivo

Um processo seletivo representa uma vaga aberta ou encerrada. Os principais campos identificados são:

- código/ID do processo;
- vaga;
- quantidade de vagas;
- vagas preenchidas;
- operação;
- trilha;
- data de encerramento;
- status;
- nota de corte;
- texto público da vaga/requisitos/responsabilidades;
- link/agendamento e metadados de candidatura.

### Regras

1. Processo encerrado deve bloquear movimentações internas indevidas.
2. Candidatos aprovados/eliminados/banco de talentos não devem continuar como candidatos ativos no processo.
3. O detalhe do processo mostra candidatos no processo, aprovados, entrevistas, pré-análises e ações disponíveis.
4. A quantidade de pessoas concorrendo à vaga deve considerar vínculos ativos com o processo.

## Status do candidato

O backend padroniza status em `services/process_flow.py`.

| Status | Sentido operacional |
| --- | --- |
| `Analise` | Candidato em análise inicial |
| `Qualificado` | CV/triagem indica aderência mínima |
| `Nao qualificado` | Triagem não recomenda avanço automático |
| `Agendado` | Entrevista marcada |
| `Confirmado` | Entrevista confirmada |
| `Reagendado` | Entrevista remarcada |
| `Compareceu` | Candidato compareceu |
| `Faltou` | Candidato faltou |
| `Desistente` | Candidato saiu do processo |
| `Aprovado` | Aprovado no processo |
| `Eliminado` | Eliminado do processo |
| `Banco de talentos` | Movido para reaproveitamento futuro |

### Grupos de status

- **Ativos:** análise, qualificado, agendado, confirmado, reagendado, compareceu.
- **Terminais:** não qualificado, desistente, aprovado, eliminado, banco de talentos.
- **Entrevista:** agendado, confirmado, reagendado, compareceu, faltou.

## Caixa de e-mail e análise de CV

A caixa de e-mail permite ao RH:

1. Ver e-mails recebidos com anexos.
2. Abrir detalhes do e-mail.
3. Baixar/visualizar anexo.
4. Executar análise de CV.
5. Vincular candidato a um processo.
6. Enviar candidato ao banco de talentos.
7. Ignorar e-mail.
8. Excluir e-mail.

A análise de CV tenta extrair:

- nome;
- e-mail;
- telefone/WhatsApp;
- cidade/bairro;
- competências;
- experiências;
- formação;
- palavras-chave;
- score e classificação.

### Regra importante

Mesmo candidatos classificados como não qualificados podem ser aproveitados manualmente pelo RH. O sistema deve permitir decisão humana quando o RH entende que o candidato vale análise.

## Prova/teste

O fluxo de prova possui etapas por nível/trilha. O sistema registra:

- candidato;
- vaga;
- nível;
- trilha;
- pontuação final;
- pontuação bruta;
- status de finalização;
- tempo;
- arquivo de gabarito;
- etapas em JSON.

A regra de segurança observada no frontend exige autenticação/admin para abrir resultado, retornar ao menu interno ou sair do fluxo em pontos sensíveis.

## Entrevistas e slots

O sistema separa **slot** de **entrevista marcada**.

- Slot = janela de horário disponível, com capacidade.
- Entrevista = candidato agendado em um slot ou data específica.

Regras:

1. Um slot possui data, hora inicial, hora final, duração e capacidade total.
2. O slot disponível deve aparecer na hora de agendar candidato.
3. A capacidade ocupada deve ser consumida conforme entrevistas vinculadas.
4. Status de entrevista influencia status visível do candidato.
5. Candidatos só devem poder agendar entrevista se estiverem em status permitido.

## Aprovação e eliminação

Na aprovação, o sistema comporta:

- mensagem personalizada;
- checklist de documentos;
- data de comparecimento;
- eventual anexo;
- envio por WhatsApp/e-mail conforme implementação disponível.

Na eliminação, deve registrar:

- motivo;
- etapa da eliminação;
- data;
- status final.

## Banco de talentos

O banco de talentos guarda candidatos para uso futuro. O RH pode:

1. Consultar candidatos.
2. Filtrar por nome/vaga/contato.
3. Editar perfil.
4. Abrir currículo.
5. Remover do banco.
6. Usar candidato em processo aberto.

## Relatórios

O menu Análise traz relatórios por:

- processos;
- candidatos;
- detalhes de análise;
- exportações por endpoint.

A finalidade é dar visão de andamento, volume, qualificação e decisão.
