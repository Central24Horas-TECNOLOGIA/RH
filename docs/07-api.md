# 07 - API

## Base URL

- Padrao local: `http://127.0.0.1:8000`

## Padrao de autenticacao

- Header: `Authorization: Bearer <token>`
- Login gera token local assinado.

## Padrao de resposta de erro

```json
{
  "success": false,
  "message": "Mensagem amigavel"
}
```

Erros de validacao podem incluir `details`.

## Endpoints

### Sistema

| Metodo | Rota | Descricao |
| --- | --- | --- |
| `GET` | `/` | Healthcheck basico da API |
| `GET` | `/debug/gabaritos-columns` | Lista colunas da tabela `gabaritos` |

### Autenticacao

| Metodo | Rota | Descricao |
| --- | --- | --- |
| `POST` | `/auth/login` | Gera token |
| `GET` | `/auth/me` | Valida sessao atual |
| `POST` | `/auth/logout` | Encerra sessao logica |

Exemplo de login:

```json
POST /auth/login
{
  "usuario": "rh.local",
  "senha": "senha-segura"
}
```

Resposta:

```json
{
  "access_token": "<token>",
  "usuario": "rh.local"
}
```

### Historico e gabaritos

| Metodo | Rota | Descricao |
| --- | --- | --- |
| `GET` | `/history` | Lista historico, com filtros e paginacao opcional |
| `POST` | `/history` | Salva historico da prova |
| `GET` | `/answer-files` | Lê payloads salvos |
| `POST` | `/answer-files` | Salva payload completo da prova |

Parametros de `GET /history`:

- `page`
- `page_size`
- `nome`
- `vaga`
- `data`

### Processos

| Metodo | Rota | Descricao |
| --- | --- | --- |
| `GET` | `/processes` | Lista processos |
| `POST` | `/processes` | Cria processo |
| `PUT` | `/processes/{id_processo}` | Atualiza processo |
| `POST` | `/processes/{id_processo}/close` | Encerra processo |
| `GET` | `/processes/{id_processo}/details` | Resumo e candidatos do processo |
| `GET` | `/processes/{id_processo}/cv-pre-analyses` | Lista pre-analises paginadas |
| `POST` | `/processes/{id_processo}/cv-pre-analyses` | Envia CV para analise |

Payload de criacao de processo:

```json
{
  "id_processo": "PROC.ANL.001",
  "vaga": "Analista",
  "quantidade_vagas": 2,
  "vagas_preenchidas": 0,
  "data_encerramento": "2026-04-30",
  "operacao": "Backoffice",
  "trilha": "TI",
  "usa_nota_corte": 1,
  "nota_corte": 7.0,
  "status": "Aberto",
  "data_criacao": "2026-04-19T08:00:00",
  "link_agendamento": "https://meet.exemplo"
}
```

### Candidatos do processo e banco de talentos

| Metodo | Rota | Descricao |
| --- | --- | --- |
| `GET` | `/process-candidates` | Lista candidatos vinculados |
| `POST` | `/process-candidates` | Cria vinculo de candidato ao processo |
| `PUT` | `/process-candidates/{id_registro}/status` | Atualiza status do candidato |
| `GET` | `/talent-bank` | Lista banco de talentos |
| `DELETE` | `/talent-bank/{id_banco}` | Remove candidato do banco |
| `POST` | `/talent-bank/{id_banco}/use` | Reaproveita candidato em processo |
| `PUT` | `/candidate-profiles/{id_teste}` | Atualiza tags, habilidades e observacao |

### Pre-analise de CV

| Metodo | Rota | Descricao |
| --- | --- | --- |
| `PUT` | `/cv-pre-analyses/{id_pre_analise}` | Atualiza dados da pre-analise |
| `DELETE` | `/cv-pre-analyses/{id_pre_analise}` | Exclui pre-analise |
| `POST` | `/cv-pre-analyses/{id_pre_analise}/add-to-process` | Adiciona CV ao processo |

### Pipeline

| Metodo | Rota | Descricao |
| --- | --- | --- |
| `GET` | `/candidate-pipeline` | Lista pipeline |
| `POST` | `/candidate-pipeline` | Cria card manual |
| `PUT` | `/candidate-pipeline/{id_registro}/stage` | Move card |
| `DELETE` | `/candidate-pipeline/{id_registro}` | Exclui card |

Exemplo de card:

```json
{
  "id_processo": "PROC.ANL.001",
  "nome_candidato": "Ana Souza",
  "vaga": "Analista",
  "etapa_pipeline": "Triagem"
}
```

### Entrevistas

| Metodo | Rota | Descricao |
| --- | --- | --- |
| `GET` | `/interviews` | Lista entrevistas |
| `POST` | `/interviews` | Agenda entrevista |
| `PUT` | `/interviews/{id_entrevista}` | Atualiza entrevista |

Parametros de `GET /interviews`:

- `id_processo`
- `status_entrevista`
- `search`

Payload de agendamento:

```json
{
  "id_registro": 10,
  "id_processo": "PROC.ANL.001",
  "data_entrevista": "2026-04-22T14:00:00",
  "status_entrevista": "Agendado",
  "link_agendamento": "https://meet.exemplo",
  "observacoes_rh": "Levar case pratico"
}
```

### Analytics

| Metodo | Rota | Descricao |
| --- | --- | --- |
| `GET` | `/candidate-analytics` | Lista ranking analitico |
| `GET` | `/candidate-analytics/{id_teste}` | Detalha analise do candidato |

## Codigos de status importantes

- `200`: sucesso
- `201`: nao utilizado explicitamente no repositorio atual
- `400`: erro de regra ou parametros obrigatorios ausentes
- `401`: autenticacao obrigatoria, token invalido ou sessao expirada
- `404`: processo, candidato, entrevista ou prova nao encontrado
- `422`: validacao de payload
- `500`: erro interno ou falha de acesso a banco
- `503`: indisponibilidade temporaria, inclusive deadlock tratado

## Observacoes operacionais

- O endpoint de detalhe do processo nao deve mais disparar bootstrap de tabela em rota de leitura.
- Deadlock de SQL Server recebe retry baixo no repositorio e retorno amigavel na API.
