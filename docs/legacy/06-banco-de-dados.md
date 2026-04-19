# 06 - Banco de Dados

## Plataforma

- Banco principal: SQL Server
- Driver padrao: `ODBC Driver 17 for SQL Server`
- Modo de acesso: `Trusted_Connection=yes`

## Observacao importante

O sistema atual trabalha com tabelas legadas ja existentes e algumas tabelas complementares que o backend garante no bootstrap de inicializacao.

## Tabelas principais

### `processos_seletivos`

Uso: cadastro e manutencao de processos seletivos.

Campos utilizados pelo sistema:

| Campo | Tipo esperado | Papel |
| --- | --- | --- |
| `id_processo` | NVARCHAR | Identificador do processo |
| `vaga` | NVARCHAR | Nome da vaga |
| `quantidade_vagas` | INT | Total de vagas |
| `vagas_preenchidas` | INT | Vagas ja ocupadas |
| `data_encerramento` | NVARCHAR ou data legada | Data limite do processo |
| `operacao` | NVARCHAR | Contexto operacional |
| `trilha` | NVARCHAR | Trilha da prova ou area |
| `usa_nota_corte` | BIT/INT | Indicador de corte |
| `nota_corte` | DECIMAL/FLOAT | Valor da nota de corte |
| `status` | NVARCHAR | Aberto ou Encerrado |
| `data_criacao` | NVARCHAR ou data legada | Data de abertura |
| `link_agendamento` | NVARCHAR(MAX) | Link reaproveitado para entrevista |

Chave principal:

- `id_processo` e tratado como identificador funcional unico no sistema.

### `candidatos_processos`

Uso: vinculo do candidato ao processo, inclusive pipeline.

Campos utilizados:

| Campo | Tipo esperado | Papel |
| --- | --- | --- |
| `id_registro` | INT | Identificador interno do vinculo |
| `id_processo` | NVARCHAR | Processo de destino |
| `id_teste` | NVARCHAR | Referencia da prova/historico |
| `nome_candidato` | NVARCHAR | Nome do candidato |
| `vaga` | NVARCHAR | Vaga associada |
| `status_candidato` | NVARCHAR | Estado operacional atual |
| `pontuacao_final` | NVARCHAR/NUM | Nota final |
| `data_prova` | NVARCHAR/DATETIME | Data da prova |
| `data_movimentacao` | NVARCHAR/DATETIME | Data de mudanca de status legado |
| `origem` | NVARCHAR | Origem do registro |
| `etapa_pipeline` | NVARCHAR(30) | Etapa do kanban |
| `data_atualizacao_pipeline` | DATETIME | Ultima mudanca de etapa |

Chave principal pratica:

- `id_registro`

### `historico_provas`

Uso: historico consolidado do resultado da prova.

Campos utilizados:

| Campo | Tipo esperado | Papel |
| --- | --- | --- |
| `id_teste` | NVARCHAR | Identificador da prova |
| `id_processo` | NVARCHAR | Processo associado ou `PROCESSO_UNICO` |
| `nome_candidato` | NVARCHAR | Nome do candidato |
| `vaga` | NVARCHAR | Vaga avaliada |
| `nivel` | NVARCHAR | Nivel da prova |
| `trilha` | NVARCHAR | Trilha ou area |
| `data_iso` | NVARCHAR | Data tecnica ordenavel |
| `data_exibicao` | NVARCHAR | Data formatada para interface |
| `pontuacao_final` | NVARCHAR/NUM | Nota final ponderada |
| `status` | NVARCHAR | Resultado final |
| `tempo_minutos` | INT/FLOAT | Tempo da prova |
| `arquivo_gabarito` | NVARCHAR | Referencia textual/payload complementar |
| `etapas_json` | NVARCHAR(MAX) | Resumo por etapa em JSON |

### `gabaritos`

Uso: armazenamento do payload completo da prova.

Campos utilizados:

| Campo | Tipo esperado | Papel |
| --- | --- | --- |
| `record_id` | NVARCHAR | Identificador equivalente ao `id_teste` |
| `payload_json` ou `playlaod_json` | NVARCHAR(MAX) | Payload serializado do resultado |

Observacao:

- O backend suporta tanto `payload_json` quanto o nome legado com erro ortografico `playlaod_json`.

### `banco_talentos`

Uso: reaproveitamento de candidatos.

Campos utilizados:

| Campo | Tipo esperado | Papel |
| --- | --- | --- |
| `id_banco` | INT | Identificador do banco |
| `id_processo` | NVARCHAR | Processo de origem |
| `id_teste` | NVARCHAR | Identificador da prova |
| `nome_candidato` | NVARCHAR | Nome do candidato |
| `vaga` | NVARCHAR | Vaga de origem |
| `pontuacao_final` | NVARCHAR/NUM | Nota registrada |
| `data_movimentacao` | NVARCHAR/DATETIME | Data de envio ao banco |
| `origem` | NVARCHAR | Origem funcional |

## Tabelas complementares criadas/garantidas pelo backend

### `candidatos_metadata`

Uso: enriquecimento de tags, habilidades e observacoes.

| Campo | Tipo | Papel |
| --- | --- | --- |
| `id_teste` | NVARCHAR(120) PK | Chave do candidato/prova |
| `nome_candidato` | NVARCHAR(255) | Nome espelho |
| `habilidades_json` | NVARCHAR(MAX) | Lista de habilidades |
| `tags_json` | NVARCHAR(MAX) | Lista de tags |
| `observacao_rh` | NVARCHAR(MAX) | Observacao livre |
| `criado_em` | DATETIME | Criacao |
| `atualizado_em` | DATETIME | Atualizacao |

### `cv_pre_analises`

Uso: fila e resultado de pre-analise de CV.

| Campo | Tipo | Papel |
| --- | --- | --- |
| `id_pre_analise` | INT PK identity | Identificador |
| `id_processo` | NVARCHAR(60) | Processo alvo |
| `nome_candidato` | NVARCHAR(255) | Nome detectado |
| `email` | NVARCHAR(255) | E-mail detectado |
| `telefone` | NVARCHAR(50) | Telefone |
| `whatsapp` | NVARCHAR(50) | WhatsApp |
| `palavras_chave` | NVARCHAR(MAX) | Lista de palavras-chave |
| `score_final` | DECIMAL(5,2) | Score da analise |
| `classificacao` | NVARCHAR(50) | Resultado textual |
| `classificacao_slug` | NVARCHAR(50) | Classe tecnica |
| `problemas` | NVARCHAR(MAX) | Lista serializada de problemas |
| `texto_extraido` | NVARCHAR(MAX) | Texto lido do arquivo |
| `nome_arquivo` | NVARCHAR(255) | Nome original |
| `mime_type` | NVARCHAR(120) | Tipo do arquivo |
| `arquivo_original_base64` | NVARCHAR(MAX) | Conteudo opcional persistido |
| `ja_adicionado_ao_processo` | BIT | Controle de inclusao |
| `criado_em` | DATETIME | Data de criacao |

### `entrevistas_agendadas`

Uso: agenda operacional de entrevistas.

| Campo | Tipo | Papel |
| --- | --- | --- |
| `id_entrevista` | INT PK identity | Identificador |
| `id_processo` | NVARCHAR(60) | Processo vinculado |
| `id_registro` | INT | Vaga do candidato em `candidatos_processos` |
| `id_teste` | NVARCHAR(120) | Chave da prova |
| `nome_candidato` | NVARCHAR(255) | Nome |
| `vaga` | NVARCHAR(255) | Vaga |
| `data_entrevista` | DATETIME | Data e hora |
| `status_entrevista` | NVARCHAR(30) | Agendado, Confirmado, Compareceu, Faltou |
| `link_agendamento` | NVARCHAR(MAX) | Link final usado |
| `observacoes_rh` | NVARCHAR(MAX) | Observacao do RH |
| `mensagem_base` | NVARCHAR(MAX) | Texto pronto para envio |
| `criado_em` | DATETIME | Criacao |
| `atualizado_em` | DATETIME | Atualizacao |

## Relacionamentos funcionais

```text
processos_seletivos (id_processo)
  -> candidatos_processos.id_processo
  -> cv_pre_analises.id_processo
  -> entrevistas_agendadas.id_processo
  -> banco_talentos.id_processo

historico_provas (id_teste)
  -> candidatos_processos.id_teste
  -> banco_talentos.id_teste
  -> candidatos_metadata.id_teste
  -> entrevistas_agendadas.id_teste
  -> gabaritos.record_id
```

## Regras de preenchimento

- `id_teste` precisa ser consistente entre historico, processo, metadata e entrevista.
- `id_registro` controla o candidato dentro do processo e e chave para agendar entrevista.
- `vagas_preenchidas` deve refletir aprovacoes ativas.
- `etapa_pipeline` e `status_candidato` precisam continuar coerentes.
- `link_agendamento` do processo pode ser herdado para a entrevista quando nao informado no agendamento.
