# Estrutura do projeto

## Raiz

- `Front/`: frontend ativo.
- `api/`: backend ativo.
- `data/`: dados legados e materiais locais fora do fluxo principal da aplicacao.
- `docs/`: documentacao tecnica e operacional atual.
- `.env.example`: modelo de configuracao local.
- `pytest.ini`: padrao de execucao de testes.

## Frontend

```text
Front/
|-- estilos/
|-- Exames/
|-- fonte/
|   |-- app/
|   |-- dados-excel/
|   |-- features/
|   |-- services/
|   |-- shared/
|   |-- types/
|   |-- ui/
|-- index.html
```

- `Front/estilos/`: CSS global, layout e logos.
- `Front/Exames/`: arquivos de apoio de provas e planilhas de referencia.
- `Front/fonte/app/`: bootstrap da aplicacao, roteamento por hash e controlador central de estado.
- `Front/fonte/dados-excel/`: dados estaticos utilizados na montagem de planilhas.
- `Front/fonte/features/`: telas e modulos de negocio do frontend.
- `Front/fonte/services/api/`: cliente da API separado por dominio.
- `Front/fonte/shared/`: validacoes, helpers visuais e componentes pequenos reutilizaveis.
- `Front/fonte/types/`: tipos usados em JSDoc e apoio de edicao.
- `Front/fonte/ui/`: layout, busca global, tour guiado e componentes compartilhados da interface.

## Features do frontend

- `features/gestao/`: login, inicio, historico, criacao de processo, banco de talentos e analise de candidatos.
- `features/processos/`: lista de processos, detalhe do processo e estado local ligado a processo/pipeline.
- `features/pipeline/`: quadro de pipeline de candidatos.
- `features/entrevistas/`: agenda e acompanhamento de entrevistas.
- `features/prova/`: configuracao da prova, candidato, execucao, conclusao e resultado.

Os arquivos antigos `telas-*.js` e `tela-*.js` continuam existindo apenas como barreis de compatibilidade para nao espalhar quebra de import.

## Backend

```text
api/
|-- app.py
|-- rh_api/
|   |-- repositories/
|   |-- routers/
|   |-- schemas/
|   |-- services/
|   |-- auth.py
|   |-- config.py
|   |-- dependencies.py
|   |-- main.py
|-- tests/
```

- `api/app.py`: entrypoint do Uvicorn.
- `api/rh_api/main.py`: cria a app FastAPI, middlewares, tratamento global de erros e registro de rotas.
- `api/rh_api/routers/`: endpoints HTTP separados por dominio.
- `api/rh_api/schemas/`: contratos de entrada e saida.
- `api/rh_api/services/`: logica auxiliar de aplicacao que nao deve ficar nas rotas.
- `api/rh_api/repositories/`: persistencia e queries do banco separadas por dominio.
- `api/tests/`: testes automatizados do backend com fake repository.

## Repositorios do backend

- `repositories/processes.py`: processos, candidatos do processo e detalhes.
- `repositories/history.py`: historico e arquivos de resposta.
- `repositories/pipeline.py`: pipeline de candidatos.
- `repositories/interviews.py`: entrevistas.
- `repositories/talent_bank.py`: banco de talentos.
- `repositories/profiles.py`: perfil do candidato.
- `repositories/cv_analysis.py`: pre-analise e analise de CV.
- `repositories/analytics.py`: agregados e leituras analiticas.
- `repositories/bootstrap.py`: bootstrap de schema e tratamento de erro de banco.
- `repositories/db_repository.py`: fachada de compatibilidade.

## Dados e legado

- `data/legacy/access/rh_provas.accdb`: base legada movida para uma area explicita de legado.
- `docs/legacy/`: documentacao historica preservada, fora do fluxo principal.
