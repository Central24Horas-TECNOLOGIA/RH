# Conexa RH

Aplicacao local para RH com frontend web, backend FastAPI e banco SQL Server, cobrindo login, dashboard, processos seletivos, provas, pipeline, banco de talentos, entrevistas, historico e analise de candidatos.

## Estrutura

- `Front/`: frontend web estatico com React via ESM, HTM e CSS modular.
- `api/`: backend FastAPI, autenticacao local, repositorio SQL Server e testes.
- `data/`: artefatos locais legados do projeto.
- `docs/`: documentacao funcional, tecnica e operacional.

## Subida rapida

### Backend

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn api.app:app --reload --host 127.0.0.1 --port 8000
```

### Frontend

Sirva a raiz do projeto em um servidor estatico local e abra:

```text
http://127.0.0.1:5500/Front/index.html#/login
```

Exemplo simples:

```powershell
python -m http.server 5500
```

## Configuracao

Use `.env.example` como base para o arquivo `.env`.

Principais variaveis:

- `RH_SQL_SERVER`
- `RH_SQL_DATABASE`
- `RH_SQL_DRIVER`
- `RH_AUTH_USER`
- `RH_AUTH_PASSWORD`
- `RH_AUTH_TOKEN_SECRET`
- `RH_AUTH_TOKEN_TTL_MINUTES`

## Documentacao

O indice completo esta em [docs/README.md](docs/README.md).
