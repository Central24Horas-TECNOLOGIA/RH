# 11 - Manutencao

## Convencoes do projeto

- Backend concentrado em `DatabaseRepository`.
- Rotas HTTP separadas por modulo em `api/rh_api/routers/`.
- Validacoes de payload em `api/rh_api/schemas/`.
- Regras de dominio em `api/rh_api/services/`.
- Frontend organizado por telas em `Front/fonte/features/`.
- Componentes compartilhados em `Front/fonte/ui/`.
- Helpers e validacoes compartilhadas em `Front/fonte/shared/`.

## Nomenclatura

- Telas frontend usam `screen-*`.
- Rotas hash usam nomes funcionais em portugues simplificada.
- Funcoes de leitura usam `ler*` no frontend e `list_*` ou `get_*` no backend.
- Funcoes de escrita usam `criar*`, `atualizar*`, `salvar*`, `delete_*` ou `create_*`.

## Como criar uma nova tela

1. Criar o componente em `Front/fonte/features/`.
2. Registrar a rota em `Front/fonte/rotas.js`.
3. Integrar a tela em `Front/fonte/aplicacao.js`.
4. Se houver navegacao lateral, atualizar `componentes-compartilhados.js`.
5. Se a tela precisar de tour, adicionar configuracao em `shared/tour-config.js`.

## Como adicionar nova rota de API

1. Criar ou ajustar schema em `api/rh_api/schemas/`.
2. Criar a funcao de dominio ou reuso no repositorio.
3. Expor a rota em `api/rh_api/routers/`.
4. Incluir chamada no frontend em `Front/fonte/servico-api.js`.
5. Validar autenticacao e erros padronizados.

## Como alterar banco com seguranca

- Preferir bootstrap controlado ou migracao explicita.
- Evitar DDL em rotas de leitura frequentes.
- Em alteracao de schema complementar, centralizar a garantia em `bootstrap_runtime_schema`.
- Validar impacto em:
  - processos
  - candidatos_processos
  - banco_talentos
  - entrevistas
  - historico

## Cuidados antes de publicar

- Validar login.
- Validar historico.
- Validar criacao e detalhe de processo.
- Validar pipeline.
- Validar banco de talentos.
- Validar entrevistas.
- Confirmar que erros da API seguem o padrao `success/message`.

## Cuidados especificos do legado

- Nao assumir schema totalmente homogeneo em tabelas antigas.
- Manter compatibilidade com `payload_json` e `playlaod_json`.
- Nao remover colunas ou mudar nomes usados pelo frontend sem ponte de compatibilidade.
- Nao quebrar `PROCESSO_UNICO`.

## Tour guiado

- Persistencia atual em `localStorage`.
- Chave: `rh_tour_visto:<screenId>:<usuario|anonimo>`.
- Ao incluir nova tela, manter o tour leve e nao modal.

## Densidade visual

- Ajustes globais ficam em:
  - `Front/estilos/tokens.css`
  - `Front/estilos/base.css`
  - `Front/estilos/layout.css`
  - `Front/estilos/screens.css`
- Evitar sobrescritas pontuais excessivas em cada tela.
