# Documentação Conecta C24h - RH

> Gerado a partir da análise do pacote `RH(20).zip`. Esta documentação descreve o sistema existente, seus fluxos, telas, APIs, banco, código, testes, operação e manual do usuário.


## Banco

SQL Server via `pyodbc`. O backend garante tabelas complementares em `bootstrap.py`.

## Tabelas principais em uso

- `processos_seletivos`
- `candidatos_processos`
- `historico_provas`
- `gabaritos`
- `banco_talentos`

## Tabelas complementares criadas/garantidas

### `cv_pre_analises`

- `id_pre_analise INT IDENTITY(1,1) PRIMARY KEY`
- `id_processo NVARCHAR(60) NULL`
- `id_processo_ref NVARCHAR(255) NULL`
- `nome_candidato NVARCHAR(255) NULL`
- `email NVARCHAR(255) NULL`
- `telefone NVARCHAR(50) NULL`
- `whatsapp NVARCHAR(50) NULL`
- `palavras_chave NVARCHAR(MAX) NULL`
- `score_final DECIMAL(5,2) NULL`
- `classificacao NVARCHAR(80) NULL`
- `classificacao_slug NVARCHAR(80) NULL`
- `problemas NVARCHAR(MAX) NULL`
- `texto_extraido NVARCHAR(MAX) NULL`
- `nome_arquivo NVARCHAR(255) NULL`
- `mime_type NVARCHAR(120) NULL`
- `arquivo_original_base64 NVARCHAR(MAX) NULL`
- `ja_adicionado_ao_processo BIT NULL`
- `oculto_na_lista BIT NULL`
- `origem NVARCHAR(120) NULL`
- `email_uid NVARCHAR(120) NULL`
- `email_message_id NVARCHAR(255) NULL`
- `email_attachment_name NVARCHAR(255) NULL`
- `email_remetente NVARCHAR(255) NULL`
- `email_assunto NVARCHAR(500) NULL`
- `email_data DATETIME NULL`
- `criado_em DATETIME NULL`

### `candidatos_metadata`

- `id_teste NVARCHAR(120) NOT NULL PRIMARY KEY`
- `nome_candidato NVARCHAR(255) NULL`
- `habilidades_json NVARCHAR(MAX) NULL`
- `tags_json NVARCHAR(MAX) NULL`
- `observacao_rh NVARCHAR(MAX) NULL`
- `email NVARCHAR(255) NULL`
- `telefone NVARCHAR(50) NULL`
- `whatsapp NVARCHAR(50) NULL`
- `cidade NVARCHAR(120) NULL`
- `bairro NVARCHAR(120) NULL`
- `criado_em DATETIME NOT NULL DEFAULT GETDATE()`
- `atualizado_em DATETIME NOT NULL DEFAULT GETDATE()`

### `candidatos_anexos`

- `id_anexo INT IDENTITY(1,1) PRIMARY KEY`
- `id_teste NVARCHAR(120) NULL`
- `id_processo NVARCHAR(60) NULL`
- `id_processo_ref NVARCHAR(255) NULL`
- `nome_arquivo_original NVARCHAR(255) NULL`
- `nome_arquivo_armazenado NVARCHAR(255) NULL`
- `tipo_arquivo NVARCHAR(120) NULL`
- `caminho_arquivo NVARCHAR(500) NULL`
- `tamanho_bytes BIGINT NULL`
- `criado_em DATETIME NULL`
- `atualizado_em DATETIME NULL`

### `email_inbox_items`

- `id NVARCHAR(120) NOT NULL PRIMARY KEY`
- `message_uid NVARCHAR(120) NULL`
- `message_id NVARCHAR(500) NULL`
- `remetente NVARCHAR(500) NULL`
- `remetente_nome NVARCHAR(255) NULL`
- `assunto NVARCHAR(500) NULL`
- `data_recebimento DATETIME NULL`
- `resumo NVARCHAR(MAX) NULL`
- `corpo_texto NVARCHAR(MAX) NULL`
- `nome_detectado NVARCHAR(255) NULL`
- `telefone_detectado NVARCHAR(50) NULL`
- `email_detectado NVARCHAR(255) NULL`
- `vaga_detectada NVARCHAR(255) NULL`
- `status NVARCHAR(80) NULL`
- `origem NVARCHAR(120) NULL`
- `caminho_anexo NVARCHAR(500) NULL`
- `nome_anexo NVARCHAR(255) NULL`
- `content_type NVARCHAR(120) NULL`
- `tamanho_anexo BIGINT NULL`
- `attachments_json NVARCHAR(MAX) NULL`
- `metadata_path NVARCHAR(500) NULL`
- `processo_id NVARCHAR(255) NULL`
- `candidato_id NVARCHAR(120) NULL`
- `id_pre_analise INT NULL`
- `id_registro INT NULL`
- `id_banco INT NULL`
- `criado_em DATETIME NULL`
- `atualizado_em DATETIME NULL`
- `ignorado BIT NULL`

### `candidatos_movimentacoes`

- `id_movimentacao INT IDENTITY(1,1) PRIMARY KEY`
- `id_teste NVARCHAR(120) NULL`
- `id_registro INT NULL`
- `id_processo NVARCHAR(60) NULL`
- `id_processo_ref NVARCHAR(255) NULL`
- `nome_candidato NVARCHAR(255) NULL`
- `vaga NVARCHAR(255) NULL`
- `origem_inicial NVARCHAR(120) NULL`
- `tipo_movimentacao NVARCHAR(120) NULL`
- `status_anterior NVARCHAR(80) NULL`
- `status_novo NVARCHAR(80) NULL`
- `observacao NVARCHAR(MAX) NULL`
- `usuario_responsavel NVARCHAR(120) NULL`
- `processo_destino NVARCHAR(255) NULL`
- `criado_em DATETIME NOT NULL DEFAULT GETDATE()`

### `entrevistas_agendadas`

- `id_entrevista INT IDENTITY(1,1) PRIMARY KEY`
- `id_processo NVARCHAR(60) NULL`
- `id_processo_ref NVARCHAR(255) NULL`
- `id_registro INT NULL`
- `id_teste NVARCHAR(120) NULL`
- `nome_candidato NVARCHAR(255) NULL`
- `vaga NVARCHAR(255) NULL`
- `data_entrevista DATETIME NULL`
- `status_entrevista NVARCHAR(80) NULL`
- `link_agendamento NVARCHAR(MAX) NULL`
- `observacoes_rh NVARCHAR(MAX) NULL`
- `mensagem_base NVARCHAR(MAX) NULL`
- `id_slot INT NULL`
- `mensagem_personalizada NVARCHAR(MAX) NULL`
- `criado_em DATETIME NULL`
- `atualizado_em DATETIME NULL`

### `entrevista_slots`

- `id_slot INT IDENTITY(1,1) PRIMARY KEY`
- `id_processo NVARCHAR(60) NULL`
- `id_processo_ref NVARCHAR(255) NULL`
- `vaga NVARCHAR(255) NULL`
- `inicio DATETIME NULL`
- `fim DATETIME NULL`
- `capacidade_total INT NULL`
- `status_slot NVARCHAR(30) NULL`
- `id_entrevista INT NULL`
- `observacoes_rh NVARCHAR(MAX) NULL`
- `criado_em DATETIME NULL`
- `atualizado_em DATETIME NULL`

## Relações funcionais

| Tabela | Papel |
|---|---|
| `processos_seletivos` | Processo seletivo. |
| `candidatos_processos` | Candidato dentro do processo. |
| `historico_provas` | Resultado/histórico de prova. |
| `gabaritos` | Respostas/arquivos de prova. |
| `candidatos_metadata` | Dados complementares do candidato. |
| `candidatos_anexos` | Currículos e anexos. |
| `cv_pre_analises` | Pré-análises de CV. |
| `email_inbox_items` | E-mails recebidos/importados. |
| `banco_talentos` | Candidatos reaproveitáveis. |
| `entrevista_slots` | Horários disponíveis. |
| `entrevistas_agendadas` | Entrevistas marcadas. |
| `candidatos_movimentacoes` | Histórico de movimentações. |

## Cuidados

- Não inserir manualmente em coluna `IDENTITY`.
- Não dropar tabela sem backup.
- Evitar mudanças diretas em produção.
- Validar `COL_LENGTH`/`OBJECT_ID` no bootstrap ao criar coluna nova.
