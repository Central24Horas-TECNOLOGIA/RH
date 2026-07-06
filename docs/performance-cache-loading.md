# Performance, cache e carregamento

Este documento registra a estrategia aplicada para melhorar o carregamento do Conecta sem alterar regras de negocio, permisssões, fluxos ou posicionamento visual das telas.

## Otimizacoes aplicadas

- Compressao GZip ativada no FastAPI para respostas acima de 1 KB.
- Paginacao opcional adicionada aos endpoints de listagem mais amplos:
  - `GET /processes`
  - `GET /process-candidates`
  - `GET /talent-bank`
- Compatibilidade preservada: sem `page` ou `page_size`, esses endpoints continuam retornando arrays como antes.
- Quando `page` ou `page_size` sao enviados, a resposta passa a incluir:
  - `items`
  - `total`
  - `page`
  - `page_size`
  - `total_pages`
  - `has_next`
  - `has_previous`
- Queries com `SELECT *` nos repositorios ativos foram substituidas por colunas explicitas.
- Cache de frontend foi centralizado em `apps/frontend/fonte/services/api/core.js`, com TTL e politica de persistencia.
- Configuracoes pouco mutaveis agora usam cache com TTL maior:
  - perfis
  - permissoes
  - catalogo de configuracoes

## Telas e fluxos revisados

- Dashboard / Pagina inicial: usa dados resumidos e pode reaproveitar cache temporario de processos.
- Candidatos: usa `Promise.allSettled` e pode consumir paginação opcional em `lerCandidatosProcessos`, `lerBancoTalentos` e `lerProcessos`.
- Banco de Talentos: endpoint aceita `page` e `page_size`, mantendo filtros `search`, `skill` e `tag`.
- Processos abertos/encerrados: endpoint `GET /processes` aceita paginação opcional.
- Detalhes do Processo e Dossie: carregamento permanece sob demanda ao abrir a tela; dados sensiveis ficam apenas em memoria temporaria.
- Ficha do Candidato: carregada sob demanda ao abrir modal/tela.
- Provas e Resultados / Detalhes da Prova: queries usam colunas explicitas; detalhes seguem sob demanda.
- Entrevistas e Calendario: cache curto em memoria e invalidacao apos criacao/edicao de slots ou entrevistas.
- Historico e Logs: historico ja possui endpoint paginado; logs possuem limite controlado.
- Configuracoes / Perfis e Permissoes: cache persistente de sessao com TTL e invalidacao apos alteracoes.

## Estrategia de cache

O cache fica centralizado em `core.js`:

- TTL padrao: 30 segundos.
- TTL para dados sensiveis: 15 segundos.
- TTL para dados pouco mutaveis e persistiveis em sessao: 5 minutos.
- Cache sensivel nao e persistido em `sessionStorage`; fica somente em memoria.
- Cache persistente usa `sessionStorage`, nunca `localStorage`.
- Logout limpa cache de memoria e cache de sessao.

## Dados que podem usar cache persistente curto

- perfis
- permissoes
- catalogo de configuracoes
- estrutura/configuracoes auxiliares
- listas auxiliares e gabaritos operacionais quando nao contiverem dados pessoais
- lista resumida de processos

## Dados que nao devem ser persistidos

Por seguranca e LGPD, os itens abaixo nao devem ser armazenados de forma persistente no navegador:

- curriculos
- documentos
- observacoes sensiveis
- pareceres
- historico completo
- dados pessoais completos
- informacoes de entrevista
- dados sensiveis de prova
- Banco de Talentos
- candidatos vinculados a processos
- detalhes de processo com candidatos

Esses dados usam no maximo cache em memoria com TTL curto e sao invalidados apos acoes criticas.

## Regras de invalidacao

As funcoes de escrita chamam `invalidarCacheApi` apos:

- cadastro/edicao de candidato
- envio/remocao/uso do Banco de Talentos
- movimentacao ou alteracao de status de candidato
- criacao/edicao/encerramento de processo
- criacao/edicao/cancelamento/reabertura de prova
- registro/edicao de entrevista e slots
- alteracao de permissoes
- atualizacao de configuracoes
- logout

## Loading Spinner

O componente reutilizavel `LoadingState` fica em `apps/frontend/fonte/ui/components/feedback.js` e e exportado por `componentes-compartilhados.js`.

O projeto ja usa loading real em:

- abertura de processos/listagens
- detalhes do processo
- ficha do candidato
- detalhes da prova
- configuracoes
- carregamento de emails do processo
- slots/entrevistas
- pre-analises de CV

As telas mantem estados de carregando, sucesso, vazio e erro com mensagens controladas. O spinner foi mantido discreto, sem alterar o posicionamento principal dos elementos.

## Endpoints alterados

### `GET /processes`

Parametros opcionais:

- `page`
- `page_size` ate 100

Sem paginação, retorna array legado.

### `GET /process-candidates`

Parametros opcionais:

- `page`
- `page_size` ate 100

Sem paginação, retorna array legado.

### `GET /talent-bank`

Parametros existentes:

- `search`
- `skill`
- `tag`

Parametros opcionais novos:

- `page`
- `page_size` ate 100

Sem paginação, retorna array legado.

## Indices SQL recomendados

O script recomendado esta em:

`infra/sql/performance_indexes_recommended.sql`

Ele cria indices de forma idempotente para colunas usadas em filtros, ordenacao e joins:

- `id_candidato`
- `id_processo`
- `id_prova`
- `status`
- `data_criacao`
- `data_entrevista`
- `perfil`
- `tipo_processo`
- `operacao`
- `vaga`

Aplicar primeiro em HML, validar plano de execucao e tempo de escrita, depois promover para producao.

## Como testar

1. Login e logout: confirmar autenticacao e limpeza de cache ao sair.
2. Dashboard: abrir a pagina inicial e verificar cards/resumos.
3. Processos: abrir abertos, encerrados e detalhes; conferir que o layout nao mudou.
4. Candidatos: abrir central, filtrar, buscar e paginar localmente.
5. Banco de Talentos: filtrar por busca/habilidade/tag e testar retorno paginado via API.
6. Ficha do Candidato: abrir modal/tela e confirmar spinner durante carregamento.
7. Dossie do Processo: abrir detalhes e confirmar carregamento sob demanda.
8. Provas: listar, abrir detalhes e confirmar que nao houve regressao.
9. Entrevistas/Calendario: criar/editar slots e confirmar invalidacao de cache.
10. Historico/Logs: validar filtros e paginacao/limite.
11. Configuracoes: alterar perfil/catalogo e confirmar que a proxima leitura atualiza cache.
12. Erros de API: simular falha e confirmar que spinner desaparece e mensagem controlada aparece.
13. Layout: comparar posicoes de botoes, cards, tabelas, filtros e modais com a versao anterior.

## Riscos e cuidados

- A paginação nos endpoints legados e opcional para preservar compatibilidade; migrar telas gradualmente para `page`/`page_size`.
- Indices novos podem melhorar leitura, mas aumentam custo de escrita; medir em HML antes da producao.
- Dados pessoais e sensiveis devem permanecer fora de cache persistente.
- Nao aumentar TTL de dados de candidatos, entrevistas, historico, provas ou dossies sem revisao de LGPD.
