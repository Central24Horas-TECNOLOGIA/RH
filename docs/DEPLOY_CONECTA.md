# Deploy Conecta RH

Este guia documenta a nova inicializacao do Conecta RH com um unico ponto de entrada: o FastAPI serve a API e tambem o frontend localizado em `Front/`.

## 1. Desenvolvimento local

Na raiz do projeto:

```powershell
.\.venv\Scripts\python.exe run.py
```

Com reload de desenvolvimento:

```powershell
.\.venv\Scripts\python.exe run.py --reload
```

Alternativa Windows:

```powershell
.\start_conecta.ps1
```

Acesse:

```text
http://127.0.0.1:8010
```

Nao e necessario iniciar `python -m http.server` para o frontend.

## 2. Servidor interno

Para publicar na rede interna, configure host e porta por variaveis de ambiente, `.env` ou `config.ini`:

```powershell
$env:RH_APP_ENV="server"
$env:RH_SERVER_HOST="0.0.0.0"
$env:RH_SERVER_PORT="8010"
.\.venv\Scripts\python.exe run.py --no-reload
```

Com o servidor e firewall liberados, acesse pelo IP ou DNS interno, por exemplo:

```text
http://192.168.5.62:8010
```

## 3. Configuracao de ambiente

Use `.env.example` como base para `.env`. O `.env` real nao deve ser versionado.

Variaveis principais:

- `RH_APP_ENV`: `development`, `server`, `test` ou `production`.
- `RH_SERVER_HOST`: host de bind, como `127.0.0.1` local ou `0.0.0.0` no servidor.
- `RH_SERVER_PORT`: porta HTTP, padrao `8010`.
- `RH_SERVER_RELOAD`: `true` apenas em desenvolvimento.
- `RH_SERVE_FRONTEND`: `true` para servir `Front/` pelo FastAPI.
- `RH_FRONTEND_DIR`: caminho da pasta do frontend, relativo a raiz ou absoluto.
- `RH_FRONTEND_API_BASE_URL`: vazio para mesma origem; preencha somente se a API estiver em outro host.
- `RH_PUBLIC_CANDIDATE_BASE_URL`: URL publica para links de candidatura externos.

## 4. Banco de dados

Configure SQL Server por `.env` ou `config.ini`:

- `RH_SQL_SERVER`
- `RH_SQL_DATABASE`
- `RH_SQL_DRIVER`
- `RH_SQL_TRUSTED_CONNECTION`
- `RH_SQL_USERNAME`
- `RH_SQL_PASSWORD`
- `RH_SQL_ENCRYPT`
- `RH_SQL_TRUST_SERVER_CERTIFICATE`
- `RH_SQL_TIMEOUT_SECONDS`

Nao coloque senha real em documentacao, prints, commits ou mensagens de suporte.

## 5. Arquivo INI

O sistema continua lendo `config.ini` quando existir:

1. Caminho em `RH_CONFIG_INI`.
2. `config.ini` na raiz do projeto.
3. `config.ini` na pasta acima da raiz.

Use `config.ini.example` como referencia. O `config.ini` real foi adicionado ao `.gitignore`.

## 6. CORS

Com frontend e API na mesma origem, CORS quase sempre pode ficar vazio.

Em desenvolvimento, o backend ainda aceita origens locais comuns quando nenhuma origem for configurada. Em servidor ou producao, prefira definir explicitamente `RH_CORS_ALLOW_ORIGINS` apenas com dominios autorizados.

Nao use `allow_origins=["*"]` em producao.

## 7. Como parar

No terminal onde o Conecta esta rodando, use `Ctrl+C`.

Se estiver como servico Windows, pare pelo gerenciador escolhido, como NSSM, Agendador de Tarefas ou console de servicos.

## 8. Validacao rapida

Depois de iniciar:

- Abra `http://127.0.0.1:8010`.
- Verifique se a tela de login aparece.
- Abra `http://127.0.0.1:8010/api/status`.
- Confirme que `runtime-config.js`, `estilos/` e `fonte/` respondem sem 404.
- Faca login, navegue pelo menu lateral e teste logout.
- Verifique o console do navegador para erros de CORS ou assets ausentes.

## 9. Porta ocupada

Se a porta estiver ocupada, use outra porta:

```powershell
.\.venv\Scripts\python.exe run.py --port 8020
```

Ou encontre o processo no Windows:

```powershell
netstat -ano | findstr :8010
```

## 10. Servico Windows

Nao e necessario instalar servico agora, mas a estrutura ja permite.

Opcao comum com NSSM:

- Aplicacao: caminho de `.\.venv\Scripts\python.exe`.
- Argumentos: `run.py --host 0.0.0.0 --port 8010 --no-reload`.
- Diretorio inicial: raiz do projeto.

Tambem e possivel usar Agendador de Tarefas ou um proxy interno como IIS/Nginx.

## 11. Preparacao para nuvem

Antes de nuvem:

- Trocar `RH_SERVER_HOST` conforme a plataforma.
- Configurar dominio publico e HTTPS.
- Definir `RH_PUBLIC_CANDIDATE_BASE_URL`.
- Restringir CORS a dominios reais.
- Manter segredos fora do Git e preferir cofre/secret manager.
- Revisar LGPD, logs, anexos, backups e retencao de curriculos.
- Confirmar conectividade segura com SQL Server ou banco equivalente.

## 12. Comportamento preservado

- `uvicorn api.app:app` continua importando a aplicacao.
- `Front/index.html` continua existindo.
- `/Front/index.html` continua sendo aceito como compatibilidade.
- As rotas existentes da API continuam registradas antes do fallback do frontend.
- O status operacional esta disponivel em `/api/status` e `/health`.
