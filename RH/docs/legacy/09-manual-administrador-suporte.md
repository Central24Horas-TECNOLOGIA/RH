# 09 - Manual do Administrador e Suporte

## Dependencias

- Python 3
- SQL Server acessivel pelo usuario Windows atual
- ODBC Driver 17 for SQL Server
- Navegador moderno
- Servidor estatico local para a pasta do frontend

## Arquivos principais

- `.env`
- `.env.example`
- `requirements.txt`
- `api/app.py`
- `Front/index.html`

## Como subir o backend

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn api.app:app --reload --host 127.0.0.1 --port 8000
```

## Como subir o frontend

Sirva a raiz do repositorio localmente e abra:

```text
http://127.0.0.1:5500/Front/index.html#/login
```

Exemplo:

```powershell
python -m http.server 5500
```

## Variaveis de ambiente

Obrigatorias para operacao:

- `RH_SQL_SERVER`
- `RH_SQL_DATABASE`
- `RH_SQL_DRIVER`
- `RH_AUTH_USER`
- `RH_AUTH_PASSWORD`
- `RH_AUTH_TOKEN_SECRET`

Opcionais de comportamento:

- `RH_APP_ENV`
- `RH_LOG_LEVEL`
- `RH_AUTH_TOKEN_TTL_MINUTES`
- `RH_CORS_ALLOW_ORIGINS`
- `RH_CORS_ALLOW_ORIGIN_REGEX`

## Configuracao do banco

- O backend monta a conexao com `Trusted_Connection=yes`.
- O usuario Windows que executa a API precisa de permissao no banco informado.
- Na inicializacao, o backend faz bootstrap de tabelas auxiliares e colunas complementares.

## Publicacao local de atualizacao

1. Atualize os arquivos do repositorio.
2. Reinicie a API.
3. Recarregue o frontend no navegador.
4. Valide login, historico, processos, pipeline e entrevistas.

## Como verificar logs

- Os logs do backend sao emitidos em stdout pelo `logging.basicConfig`.
- Monitore principalmente:
  - falha de autenticacao
  - erro de banco
  - deadlock
  - falha de schema complementar

## Como agir em caso de erro

### Erro de autenticacao local nao configurada

- Confirme `RH_AUTH_USER` e `RH_AUTH_PASSWORD` no `.env`.

### Erro de conexao com SQL Server

- Confirme instancia, banco, driver ODBC e permissao do usuario Windows.

### Erro 503 por concorrencia no banco

- O backend ja tenta retry baixo.
- Se persistir, revise concorrencia na instancia SQL Server e locks ativos.

### Tabela auxiliar ausente

- Reinicie a API para forcar o bootstrap de schema.

## Restauracao funcional

1. Pare a API.
2. Revise `.env`.
3. Confirme conectividade com o SQL Server.
4. Suba novamente o backend.
5. Teste `/` e `/auth/login`.
6. Valide telas principais no frontend.
