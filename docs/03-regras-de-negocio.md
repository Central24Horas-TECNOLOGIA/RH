# 03 - Regras de Negocio

## Regras de autenticacao

- O acesso usa credencial local definida por `RH_AUTH_USER` e `RH_AUTH_PASSWORD`.
- O token e assinado internamente com HMAC SHA-256 e possui expiracao configuravel.
- Sem token valido, as rotas protegidas retornam erro de autenticacao.

## Regras de processo seletivo

- Todo processo possui `id_processo`, vaga, quantidade de vagas e data de encerramento.
- O processo pode ter nota de corte opcional.
- O link de agendamento do processo pode ser reaproveitado ao agendar entrevista.
- O processo pode ser encerrado manualmente.
- O processo tambem pode ser encerrado automaticamente quando o numero de aprovados atingir a quantidade de vagas.

## Regras de candidatos no processo

- Cada candidato vinculado possui `id_registro` e referencia o `id_teste`.
- O status operacional do candidato e refletido em processo, pipeline, banco de talentos e entrevistas.
- Ao aprovar um candidato, o backend incrementa `vagas_preenchidas`.
- Ao desfazer uma aprovacao, o backend decrementa `vagas_preenchidas`.
- Quando o status passa para `Banco de talentos`, o candidato e inserido na tabela `banco_talentos`.
- Quando o status deixa de ser `Banco de talentos`, o registro correspondente e removido da tabela de talentos.

## Regras de pipeline

- Etapas suportadas: `Triagem`, `Prova`, `Entrevista`, `Aprovado`, `Reprovado`.
- Etapas nao terminais mapeiam para status `Em analise`, exceto quando o candidato ja esta em `Banco de talentos`.
- Etapa `Aprovado` mapeia para status `Aprovado`.
- Etapa `Reprovado` mapeia para status `Eliminado no pipeline`.
- Cards manuais entram com origem `Pipeline manual`.

## Regras de entrevista

- Entrevista so pode ser criada para candidato valido no processo.
- A data de entrevista validada pelo schema deve ser futura.
- O status padrao inicial e `Agendado`.
- O backend gera `mensagem_base` usando candidato, processo, vaga, data e link.
- Ao agendar entrevista, o candidato e levado para etapa `Entrevista` quando ainda nao estava em estado terminal.

## Regras de banco de talentos

- O banco de talentos armazena apenas candidatos ja enviados explicitamente para esse status.
- Tags, habilidades e observacoes nao ficam na tabela base do talento; sao enriquecidas a partir de `candidatos_metadata`.
- Ao reutilizar um candidato, ele sai do banco de talentos e volta para `candidatos_processos` em etapa `Triagem`.

## Regras de pre-analise de CV

- O CV pode ser enviado em formatos como PDF, DOC, DOCX e TXT.
- O backend extrai texto e aplica score por vaga.
- A classificacao segue a logica atual:
  - `Otimo candidato` quando score e aderencia minima atendem requisitos fortes.
  - `Bom candidato` quando atende faixa intermediaria.
  - `Nao qualificado` nos demais casos.
- A pre-analise pode ser editada antes da inclusao no processo.
- Um CV ja adicionado ao processo recebe marca de controle para evitar duplicidade acidental.

## Regras de analise de candidato

- A afinidade e calculada comparando desempenho por etapa contra expectativa da vaga.
- A etapa mais critica e a de maior peso esperado.
- Se o candidato zerar a etapa mais critica, o parecer final vira `Inapto a vaga`.
- Se a afinidade for menor ou igual a 60, o parecer final vira `Inapto a vaga`.
- Se a nota de corte estiver ativa e a nota final ponderada ficar abaixo do limite, o parecer final vira `Eliminado pela nota de corte`.
- Faixas de recomendacao atuais:
  - acima de 75: `Forte aderencia`
  - acima de 60: `Boa aderencia`
  - demais: `Baixa aderencia`

## Regras de prova

- O fluxo da prova exige processo, vaga, nivel e tempo.
- O sistema suporta `PROCESSO_UNICO` para uso isolado.
- O resultado da prova alimenta historico e pode alimentar o processo selecionado.

## Regras do tour guiado

- O tour abre automaticamente apenas uma vez por tela e navegador.
- A chave de persistencia segue o padrao `rh_tour_visto:<screenId>:<usuario|anonimo>`.
- O usuario pode reabrir o tour manualmente pelo botao de ajuda.
- O tour nao deve bloquear completamente a tela.
