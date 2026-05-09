# Guia para novo mantenedor

## Por onde comecar

1. Leia `README.md`.
2. Leia `docs/estrutura-do-projeto.md`.
3. Abra `Front/fonte/app/aplicacao-raiz.js` para entender a navegacao.
4. Abra `Front/fonte/app/controlador-aplicacao.js` para entender o fluxo central do frontend.
5. Abra `api/rh_api/main.py` para entender a entrada do backend.

## Arquivos principais

- Frontend bootstrap: `Front/fonte/principal.js`
- Frontend shell: `Front/fonte/aplicacao.js`
- Navegacao: `Front/fonte/rotas.js`
- Estado e orquestracao: `Front/fonte/app/controlador-aplicacao.js`
- API client: `Front/fonte/services/api/`
- Entrada do backend: `api/app.py`
- App FastAPI: `api/rh_api/main.py`
- Persistencia: `api/rh_api/repositories/`

## Fluxo geral do sistema

1. O usuario acessa o frontend por `Front/index.html`.
2. A navegacao por hash decide a tela atual.
3. O controlador da aplicacao chama o cliente HTTP do frontend.
4. O backend recebe a requisicao em um router.
5. O router usa service e repository conforme a responsabilidade.
6. O repository acessa o banco.
7. A resposta volta para o frontend e atualiza o estado.

## Responsabilidade de cada camada

- `features/`: telas e interacoes de dominio.
- `ui/`: casca visual e componentes compartilhados de interface.
- `shared/`: validacoes, helpers e componentes pequenos.
- `services/api/`: comunicacao com backend.
- `routers/`: contrato HTTP.
- `services/`: normalizacao e regras auxiliares.
- `repositories/`: SQL e persistencia.

## O que observar antes de alterar algo

- Se a mudanca for visual, comece no frontend.
- Se a mudanca envolver dados persistidos, comece pelo repository do dominio.
- Se a mudanca for de fluxo entre telas, passe por `rotas.js` e `controlador-aplicacao.js`.
- Se a mudanca exigir novo endpoint, passe por schema, router e repository.

## O que foi preservado por compatibilidade

- `Front/fonte/servico-api.js` continua existindo como fachada.
- `api/rh_api/repositories/db_repository.py` continua existindo como fachada.
- Os arquivos antigos `telas-*.js` continuam exportando as features reorganizadas.
