# Documentacao Conecta C24h - RH

## Arquitetura logica

```text
Usuario/RH/Candidato
        |
        v
FastAPI - ponto unico em run.py
        |
        |-- Frontend estatico - Front/index.html, estilos/, fonte/, Exames/
        |-- API - api/rh_api/routers/*
        |
        v
Services - api/rh_api/services/*
        |
        v
Repositories - api/rh_api/repositories/*
        |
        v
SQL Server + armazenamento local de arquivos
```

## Camadas do frontend

| Arquivo/Pasta | Papel |
|---|---|
| `Front/index.html` | Entrada da aplicacao. |
| `Front/runtime-config.js` | Configuracao segura para execucao standalone. |
| `Front/fonte/principal.js` | Inicializa o root. |
| `Front/fonte/aplicacao.js` | Monta a aplicacao principal. |
| `Front/fonte/app/aplicacao-raiz.js` | Decide qual tela renderizar. |
| `Front/fonte/app/controlador-aplicacao.js` | Estado, navegacao e orquestracao. |
| `Front/fonte/features/*` | Telas por dominio. |
| `Front/fonte/services/api/*` | Comunicacao HTTP com backend por URL relativa. |
| `Front/fonte/ui/*` | Layout, modais, feedback, tour e busca. |

## Camadas do backend

| Arquivo/Pasta | Papel |
|---|---|
| `run.py` | Entrada unica para iniciar FastAPI + frontend. |
| `start_conecta.ps1` | Script Windows para iniciar o sistema. |
| `api/app.py` | Entrypoint compativel com Uvicorn. |
| `api/rh_api/main.py` | Cria app, middlewares, handlers, routers e arquivos estaticos. |
| `api/rh_api/config.py` | Lê `.env` e variáveis de ambiente. |
| `api/rh_api/routers/*` | Endpoints HTTP. |
| `api/rh_api/schemas/*` | Contratos de entrada/saida. |
| `api/rh_api/services/*` | Regras auxiliares. |
| `api/rh_api/repositories/*` | SQL e persistencia. |
| `api/rh_api/db.py` | Conexao com SQL Server. |

## Configuracoes principais

| Configuracao | Finalidade |
|---|---|
| `RH_APP_ENV` | Ambiente: `development`, `server`, `test` ou `production`. |
| `RH_API_HOST` / `RH_API_PORT` | Host e porta do servidor único. |
| `RH_SERVER_RELOAD` | Reload automatico, apenas para desenvolvimento. |
| `RH_FRONT_SERVE_STATIC` / `RH_FRONTEND_DIR` | Controle do Front servido pelo FastAPI. |
| `RH_FRONTEND_API_BASE_URL` | URL base da API; vazio para mesma origem. |
| `RH_SQL_SERVER` / `RH_SQL_DATABASE` / `RH_SQL_DRIVER` | Conexao SQL Server. |
| `RH_AUTH_USER` / `RH_AUTH_PASSWORD` | Bootstrap/local fallback de login. |
| `RH_AUTH_TOKEN_SECRET` | Segredo do token. |
| `RH_CORS_ALLOW_ORIGINS` | Origens externas permitidas, quando necessarias. |

## Como rodar

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python run.py
```

Com reload de desenvolvimento:

```powershell
python run.py --reload
```

Acesso:

```text
http://127.0.0.1:8000
```

## Implantacao recomendada

1. Separar pasta de codigo de pasta de anexos/CVs.
2. Configurar `.env` no servidor.
3. Criar venv e instalar dependencias.
4. Validar conexao ODBC com SQL Server.
5. Subir `run.py` sem `--reload` como processo ou servico.
6. Usar proxy reverso somente se houver necessidade de dominio, HTTPS ou balanceamento.
7. Testar login, processos, CV, e-mails, prova e entrevistas.
8. Configurar backup de banco e arquivos.

Detalhes operacionais: `docs/DEPLOY_CONECTA.md`.
