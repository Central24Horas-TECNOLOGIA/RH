# Conecta C24h

Sistema local para RH com frontend web, backend FastAPI e persistencia em SQL Server. A arquitetura foi reorganizada para deixar cada responsabilidade mais facil de localizar, manter e evoluir sem perder o comportamento existente.

## Visao geral

- `Front/`: frontend em JavaScript modular com ESM, HTM e runtime React.
- `api/`: backend FastAPI com rotas, servicos, schemas e repositorios separados por dominio.
- `data/`: dados legados e artefatos locais que nao fazem parte do codigo ativo.
- `docs/`: guias de arquitetura, manutencao, leitura e testes.

## Estrutura principal

```text
RH/
|-- Front/
|   |-- estilos/
|   |-- Exames/
|   |-- fonte/
|   |   |-- app/
|   |   |-- dados-excel/
|   |   |-- features/
|   |   |   |-- entrevistas/
|   |   |   |-- gestao/
|   |   |   |-- pipeline/
|   |   |   |-- processos/
|   |   |   |-- prova/
|   |   |-- services/
|   |   |-- shared/
|   |   |-- types/
|   |   |-- ui/
|   |-- index.html
|-- api/
|   |-- app.py
|   |-- rh_api/
|   |   |-- repositories/
|   |   |-- routers/
|   |   |-- schemas/
|   |   |-- services/
|   |-- tests/
|-- data/
|   |-- legacy/
|-- docs/
|   |-- arquitetura.md
|   |-- estrutura-do-projeto.md
|   |-- guia-de-manutencao.md
|   |-- guia-para-novo-mantenedor.md
|   |-- testes.md
|   |-- legacy/
|-- .env.example
|-- .gitignore
|-- pytest.ini
|-- requirements.txt
```

## Decisoes arquiteturais

- Frontend padronizado em JavaScript modular. A base atual ja funcionava assim, entao a refatoracao consolidou esse caminho em vez de iniciar uma migracao parcial para React + TypeScript.
- Backend mantido em FastAPI com separacao clara entre rotas, servicos, schemas e persistencia.
- `db_repository.py` virou uma fachada de compatibilidade. As queries e regras de persistencia agora ficam em repositorios menores por dominio.
- Dados pesados do frontend deixaram de ser carregados de forma eager no fluxo principal da prova.
- Testes do backend usam fake repository e nao dependem do banco real.

## Como rodar

### Backend

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn api.app:app --reload --host 127.0.0.1 --port 8000
```

### Frontend

Sirva a raiz do projeto com um servidor estatico local:

```powershell
python -m http.server 5500
```

Abra:

```text
http://127.0.0.1:5500/Front/index.html#/login
```

## Testes

```powershell
python -m pytest
```

O `pytest.ini` desabilita o cache do pytest para evitar ruido em ambientes com OneDrive.

## Configuracao

Use `.env.example` como base para o `.env`.

Variaveis principais:

- `RH_SQL_SERVER`
- `RH_SQL_DATABASE`
- `RH_SQL_DRIVER`
- `RH_AUTH_USER`
- `RH_AUTH_PASSWORD`
- `RH_AUTH_TOKEN_SECRET`
- `RH_AUTH_TOKEN_TTL_MINUTES`

## Onde alterar cada coisa

- Menu lateral e logo: [Front/fonte/ui/components/layout.js](Front/fonte/ui/components/layout.js)
- Estilos do layout: [Front/estilos/layout.css](Front/estilos/layout.css)
- Telas de gestao: [Front/fonte/features/gestao/index.js](Front/fonte/features/gestao/index.js)
- Telas de processos: [Front/fonte/features/processos/index.js](Front/fonte/features/processos/index.js)
- Telas de prova: [Front/fonte/features/prova/index.js](Front/fonte/features/prova/index.js)
- Rotas da API: [api/rh_api/routers](api/rh_api/routers)
- Queries e persistencia: [api/rh_api/repositories](api/rh_api/repositories)

## Documentacao

- [docs/README.md](docs/README.md)
- [docs/estrutura-do-projeto.md](docs/estrutura-do-projeto.md)
- [docs/arquitetura.md](docs/arquitetura.md)
- [docs/guia-de-manutencao.md](docs/guia-de-manutencao.md)
- [docs/guia-para-novo-mantenedor.md](docs/guia-para-novo-mantenedor.md)
- [docs/testes.md](docs/testes.md)
