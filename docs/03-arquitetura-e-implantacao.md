# Documentação Conecta C24h - RH

> Gerado a partir da análise do pacote `RH(20).zip`. Esta documentação descreve o sistema existente, seus fluxos, telas, APIs, banco, código, testes, operação e manual do usuário.


## Arquitetura lógica

```text
Usuário/RH/Candidato
        |
        v
Frontend estático - Front/index.html + JS modular
        |
        v
Cliente HTTP - Front/fonte/services/api/*
        |
        v
Backend FastAPI - api/rh_api/routers/*
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
| `Front/index.html` | Entrada da aplicação. |
| `Front/fonte/principal.js` | Inicializa o root. |
| `Front/fonte/aplicacao.js` | Monta a aplicação principal. |
| `Front/fonte/app/aplicacao-raiz.js` | Decide qual tela renderizar. |
| `Front/fonte/app/controlador-aplicacao.js` | Estado, navegação e orquestração. |
| `Front/fonte/features/*` | Telas por domínio. |
| `Front/fonte/services/api/*` | Comunicação HTTP com backend. |
| `Front/fonte/ui/*` | Layout, modais, feedback, tour e busca. |

## Camadas do backend

| Arquivo/Pasta | Papel |
|---|---|
| `api/app.py` | Entrypoint do Uvicorn. |
| `api/rh_api/main.py` | Cria app, middlewares, handlers e routers. |
| `api/rh_api/routers/*` | Endpoints HTTP. |
| `api/rh_api/schemas/*` | Contratos de entrada/saída. |
| `api/rh_api/services/*` | Regras auxiliares. |
| `api/rh_api/repositories/*` | SQL e persistência. |
| `api/rh_api/db.py` | Conexão com SQL Server. |

## Configurações principais

| Configuração | Finalidade |
|---|---|
| `RH_SQL_SERVER` | Servidor/instância SQL. |
| `RH_SQL_DATABASE` | Banco de dados. |
| `RH_SQL_DRIVER` | Driver ODBC. |
| `RH_AUTH_USER` / `RH_AUTH_PASSWORD` | Login local do RH. |
| `RH_AUTH_TOKEN_SECRET` | Segredo do token. |
| `RH_CORS_ALLOW_ORIGINS` | Origens permitidas. |
| `RH_CONFIG_INI` | Caminho opcional para config central. |
| `RH_EMAIL_CLIENT_SECRET` | Segredo da integração de e-mail, idealmente fora do arquivo. |

## Como rodar

### Backend

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn api.app:app --reload --host 127.0.0.1 --port 8000
```

### Frontend

```powershell
python -m http.server 5500
```

Acesso:

```text
http://127.0.0.1:5500/Front/index.html#/login
```

## Implantação recomendada

1. Separar pasta de código de pasta de anexos/CVs.
2. Configurar `.env`/`config.ini` no servidor.
3. Criar venv e instalar dependências.
4. Validar conexão ODBC com SQL Server.
5. Subir API com Uvicorn/serviço.
6. Servir frontend por IIS ou servidor estático.
7. Testar login, processos, CV, e-mails, prova e entrevistas.
8. Configurar backup de banco e arquivos.
