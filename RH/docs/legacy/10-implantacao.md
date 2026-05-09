# 10 - Implantacao

## Requisitos de ambiente

- Windows com acesso ao SQL Server
- Python instalado
- ODBC Driver 17 for SQL Server instalado
- Navegador moderno
- Porta `8000` livre para a API
- Porta local do servidor estatico livre, por exemplo `5500`

## Preparacao

1. Clonar ou copiar o repositorio.
2. Criar o arquivo `.env` com base em `.env.example`.
3. Garantir permissao do usuario Windows na instancia SQL Server.

## Instalacao

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Inicializacao do backend

```powershell
uvicorn api.app:app --host 127.0.0.1 --port 8000
```

## Inicializacao do frontend

Sirva a raiz do projeto localmente e abra:

```text
http://127.0.0.1:5500/Front/index.html#/login
```

## Portas

- Backend: `8000`
- Frontend: `5500` no fluxo local mais comum

## Permissoes

- O usuario do Windows precisa acessar a instancia SQL Server.
- O navegador precisa permitir `localStorage` para o tour guiado.

## CORS

Em desenvolvimento, a API ja aceita origens locais comuns:

- `http://127.0.0.1:3000`
- `http://127.0.0.1:4173`
- `http://127.0.0.1:5500`
- `http://127.0.0.1:8080`
- equivalentes em `localhost`

## Publicacao do frontend

- O frontend nao exige build para o modo atual.
- Basta publicar os arquivos estaticos da pasta `Front/`.

## Conexao com o banco

String montada pelo backend:

```text
DRIVER={ODBC Driver 17 for SQL Server};
SERVER=<RH_SQL_SERVER>;
DATABASE=<RH_SQL_DATABASE>;
Trusted_Connection=yes;
TrustServerCertificate=yes;
```

## Validacao pos-implantacao

1. `GET /` deve retornar `status: ok`.
2. O login deve funcionar.
3. O painel inicial deve abrir.
4. A lista de processos deve carregar.
5. Os detalhes de processo devem abrir sem erro 500.
