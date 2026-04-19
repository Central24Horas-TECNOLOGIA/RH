# 15 - Codigo e README Tecnico

## Visao tecnica da base

### Backend

- `api/app.py`: ponto de entrada para o Uvicorn.
- `api/rh_api/main.py`: cria a aplicacao FastAPI, CORS, handlers de erro e bootstrap de schema.
- `api/rh_api/repositories/db_repository.py`: camada central de acesso a dados e regras transacionais.
- `api/rh_api/services/*.py`: regras de analytics, CV, pipeline e entrevistas.
- `api/rh_api/schemas/*.py`: contratos de entrada com Pydantic.

### Frontend

- `Front/fonte/principal.js`: bootstrap da aplicacao React.
- `Front/fonte/aplicacao.js`: orquestracao global.
- `Front/fonte/app/controlador-aplicacao.js`: estado, navegacao, cache e fluxo funcional.
- `Front/fonte/servico-api.js`: chamadas HTTP e cache em memoria.
- `Front/fonte/features/`: telas funcionais.
- `Front/fonte/ui/`: componentes compartilhados, busca global e tour.
- `Front/estilos/`: tokens, base, layout, telas e impressao.

## Documentacao no codigo

Melhorias presentes ou recomendadas:

- Docstrings em pontos criticos do backend.
- Comentarios curtos apenas onde a regra nao e obvia.
- Tipos de apoio em `Front/src/types/`.

## Convencoes de manutencao

- Evitar espalhar SQL fora do repositorio principal.
- Reaproveitar helpers de normalizacao.
- Preservar nomes e contratos do frontend ao mexer em JSON de resposta.
- Testar manualmente sempre que alterar:
  - status de candidato
  - pipeline
  - detalhe de processo
  - entrevista

## README tecnico

O `README.md` da raiz agora cobre:

- estrutura do projeto
- subida rapida
- configuracao por `.env`
- ponte para a pasta `docs/`

## Melhorias futuras sugeridas

- separar migracoes de schema em rotina dedicada
- ampliar testes automatizados para repositorio SQL
- documentar exemplos reais de payload salvo em `gabaritos`
- adicionar smoke test automatizado para detalhe de processo
