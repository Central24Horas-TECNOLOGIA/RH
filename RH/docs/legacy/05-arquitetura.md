# 05 - Arquitetura

## Visao geral

O sistema segue uma arquitetura simples e local-friendly:

- Frontend estatico servido por servidor local.
- Backend FastAPI rodando em `127.0.0.1:8000`.
- SQL Server como persistencia principal.
- Navegacao por hash para evitar dependencia de build ou roteador no servidor.

## Camadas

### Frontend

- Entrada principal: `Front/fonte/principal.js`
- Composicao da aplicacao: `Front/fonte/aplicacao.js`
- Estado e orquestracao de fluxo: `Front/fonte/app/controlador-aplicacao.js`
- Integracao HTTP: `Front/fonte/servico-api.js`
- Rotas hash: `Front/fonte/rotas.js`
- Telas:
  - `features/telas-gestao.js`
  - `features/telas-processos.js`
  - `features/tela-pipeline.js`
  - `features/tela-entrevistas.js`
  - `features/telas-prova.js`
- UI compartilhada:
  - `ui/componentes-compartilhados.js`
  - `ui/busca-global.js`
  - `ui/tour-guiado.js`
- Configuracao de tour:
  - `shared/tour-config.js`

### Backend

- Entrada WSGI/ASGI: `api/app.py`
- Inicializacao FastAPI: `api/rh_api/main.py`
- Configuracao: `api/rh_api/config.py`
- Conexao com banco: `api/rh_api/db.py`
- Dependencias FastAPI: `api/rh_api/dependencies.py`
- Autenticacao local: `api/rh_api/auth.py`
- Repositorio SQL Server: `api/rh_api/repositories/db_repository.py`
- Rotas:
  - `routers/auth.py`
  - `routers/history.py`
  - `routers/processes.py`
  - `routers/interviews.py`
  - `routers/pipeline.py`
  - `routers/analytics.py`
  - `routers/system.py`
- Servicos de dominio:
  - `services/analytics.py`
  - `services/cv.py`
  - `services/interviews.py`
  - `services/pipeline.py`

## Fluxo de dados

1. O frontend chama `servico-api.js`.
2. `servico-api.js` injeta token Bearer quando a rota exige autenticacao.
3. O backend valida token em `dependencies.py`.
4. A rota encaminha a chamada para `DatabaseRepository`.
5. O repositorio executa SQL, aplica enriquecimento de dominio e retorna JSON.
6. O frontend atualiza estado local e redistribui a informacao entre telas.

## Integracoes internas importantes

- Resultado da prova -> historico -> candidatos do processo -> pipeline -> analise.
- Status do candidato -> banco de talentos e vagas preenchidas.
- Processo -> link de agendamento -> entrevista.
- Entrevista -> enriquecimento da tela de processo e da agenda geral.
- Metadata do candidato -> exibida em processo, banco de talentos, pipeline e entrevistas.

## Estrategia atual para schema complementar

- O backend faz bootstrap de schema complementar na inicializacao via `bootstrap_runtime_schema`.
- A criacao/garantia de tabelas auxiliares nao ocorre mais na leitura de detalhe de processo.
- Isso reduz lock estrutural em rotas quentes.

## Tratamento de erro

- `HTTPException` retorna JSON padronizado com `success` e `message`.
- `RequestValidationError` retorna `422` com mensagem amigavel.
- `pyodbc.Error` recebe tratamento dedicado.
- Deadlock do SQL Server retorna `503` com mensagem amigavel ao frontend.

## Observacoes de arquitetura

- O frontend usa cache curto em memoria para reduzir chamadas repetidas.
- O backend mantem a camada de dados concentrada em um repositorio unico, o que simplifica manutencao do legado.
- A aplicacao foi desenhada para continuar simples de operar em ambiente local, sem build complexo ou orquestracao distribuida.
