# Arquitetura

## Estrategia do frontend

O frontend foi consolidado em JavaScript modular com ESM. Essa foi a opcao mais segura porque:

- o projeto ja operava nesse modelo;
- evita migracao parcial para TypeScript em runtime;
- preserva comportamento com risco menor;
- deixa a manutencao mais simples para alteracoes futuras.

O runtime visual continua baseado em React via HTM, sem etapa obrigatoria de build.

## Camadas do frontend

1. `Front/index.html` carrega a aplicacao.
2. `Front/fonte/principal.js` inicializa o root.
3. `Front/fonte/aplicacao.js` monta a app principal.
4. `Front/fonte/app/aplicacao-raiz.js` resolve a tela atual.
5. `Front/fonte/app/controlador-aplicacao.js` concentra estado, navegacao e orquestracao.
6. `Front/fonte/features/*` renderiza telas e interacoes de cada dominio.
7. `Front/fonte/services/api/*` conversa com a API.

## Camadas do backend

1. `api/app.py` expone a aplicacao para o servidor.
2. `api/rh_api/main.py` monta FastAPI, middlewares e handlers globais.
3. `api/rh_api/routers/*` recebe HTTP e valida a entrada.
4. `api/rh_api/services/*` aplica regras auxiliares e normalizacao.
5. `api/rh_api/repositories/*` executa queries e persistencia.
6. `api/rh_api/db.py` cria conexao com o banco.

## Quebra do antigo db_repository.py

O antigo arquivo monolitico foi dividido para reduzir acoplamento e deixar obvio onde cada query mora:

- processos
- historico
- pipeline
- entrevistas
- banco de talentos
- perfil de candidato
- CV e pre-analise
- analytics
- bootstrap de schema

`db_repository.py` continua no projeto apenas como fachada de compatibilidade para os pontos que ainda importam `DatabaseRepository`.

## Dados pesados do frontend

Os dados base de planilha usados pela prova deixaram de ficar amarrados no fluxo principal da aplicacao. Agora:

- os arquivos continuam em `Front/fonte/dados-excel/`;
- o carregamento base foi movido para `Front/fonte/features/prova/services/excel-base-data.js`;
- `Front/fonte/regras-prova.js` faz carga sob demanda quando realmente precisa montar o workbook.

## Organizacao de UI

- `Front/fonte/ui/components/`: layout, feedback, modais e campos de prova.
- `Front/fonte/shared/components/`: acoes pequenas e trechos reutilizaveis.
- `Front/fonte/features/*/components/`: componentes locais do dominio.

## Compatibilidade controlada

Para evitar quebra desnecessaria durante a reorganizacao:

- os arquivos antigos de entrada de feature ficaram como barreis;
- a API publica do cliente HTTP em `Front/fonte/servico-api.js` foi mantida como fachada;
- `DatabaseRepository` continua disponivel no backend.

Isso permite evolucao interna sem espalhar refatoracao forçada para todos os imports de uma vez.
