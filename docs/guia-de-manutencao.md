# Guia de manutencao

## Onde alterar o menu lateral

- Estrutura e itens do menu: `Front/fonte/ui/components/layout.js`
- Estilos visuais do menu: `Front/estilos/layout.css`
- Logo do topo: `Front/estilos/logo-conecta-c24h-branca.png`

O texto do topo foi removido. O bloco superior agora trabalha apenas com a logo.

## Onde alterar nome e logo

- Login e telas de gestao: `Front/fonte/features/gestao/index.js`
- Fluxo de prova: `Front/fonte/features/prova/index.js`
- Sidebar e shell visual: `Front/fonte/ui/components/layout.js`
- Arquivos de imagem: `Front/estilos/`
- Titulos gerais: `Front/index.html`, `api/rh_api/main.py`, `README.md`, `docs/`

## Onde alterar processos

- Frontend: `Front/fonte/features/processos/index.js`
- Estado local relacionado: `Front/fonte/features/processos/state.js`
- Rotas backend: `api/rh_api/routers/processes.py`
- Persistencia: `api/rh_api/repositories/processes.py`

## Onde alterar prova

- Telas: `Front/fonte/features/prova/index.js`
- Regras da prova: `Front/fonte/regras-prova.js`
- Blueprint e perguntas: `Front/fonte/perguntas.js`
- Dados base de workbook: `Front/fonte/features/prova/services/excel-base-data.js`
- Dados estaticos: `Front/fonte/dados-excel/`

## Onde alterar pipeline

- Frontend: `Front/fonte/features/pipeline/index.js`
- Rotas backend: `api/rh_api/routers/pipeline.py`
- Servicos backend: `api/rh_api/services/pipeline.py`
- Persistencia: `api/rh_api/repositories/pipeline.py`

## Onde alterar entrevistas

- Frontend: `Front/fonte/features/entrevistas/index.js`
- Rotas backend: `api/rh_api/routers/interviews.py`
- Servicos backend: `api/rh_api/services/interviews.py`
- Persistencia: `api/rh_api/repositories/interviews.py`

## Onde alterar banco de talentos

- Frontend: `Front/fonte/features/gestao/index.js`
- Rotas backend: `api/rh_api/routers/processes.py`
- Persistencia: `api/rh_api/repositories/talent_bank.py`

## Onde ficam queries do banco

Todas as queries do banco ficam em `api/rh_api/repositories/`, separadas por dominio. Evite colocar SQL em router ou service.

## Onde ficam os servicos

- Frontend: `Front/fonte/services/api/`
- Backend: `api/rh_api/services/`

## Onde ficam as rotas

- Frontend por hash: `Front/fonte/rotas.js`
- Backend HTTP: `api/rh_api/routers/`

## Onde ficam utilitarios

- Frontend generico: `Front/fonte/utilitarios.js`
- Frontend compartilhado: `Front/fonte/shared/`
- Backend auxiliar: `api/rh_api/services/helpers.py`

## Como adicionar uma nova tela

1. Crie a tela no dominio correto dentro de `Front/fonte/features/`.
2. Exporte a tela no barrel da feature, se necessario.
3. Importe a tela em `Front/fonte/app/aplicacao-raiz.js`.
4. Adicione a rota em `Front/fonte/rotas.js`.
5. Se a tela precisar aparecer no menu, inclua o item em `Front/fonte/ui/components/layout.js`.

## Como adicionar um novo item de menu

1. Edite `Front/fonte/ui/components/layout.js`.
2. Garanta que a rota exista em `Front/fonte/rotas.js`.
3. Se houver estilo especifico, ajuste `Front/estilos/layout.css`.

## Como adicionar um novo modulo backend

1. Crie o schema em `api/rh_api/schemas/`.
2. Crie a persistencia em `api/rh_api/repositories/`.
3. Crie o router em `api/rh_api/routers/`.
4. Se houver regra auxiliar, use `api/rh_api/services/`.
5. Registre o router em `api/rh_api/main.py`.
6. Adicione testes em `api/tests/`.

## Como rodar frontend e backend

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

Abra `http://127.0.0.1:5500/Front/index.html#/login`.

## Como rodar os testes

```powershell
python -m pytest
```
