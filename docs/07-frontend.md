# 07 — Frontend

## Entrada

A entrada visual é `Front/index.html`. Ela carrega:

- Bootstrap CSS;
- Google Fonts;
- Material Symbols;
- SheetJS;
- JSZip;
- `runtime-config.js`;
- `fonte/principal.js` como módulo.

## Rotas de tela

As rotas ficam em `Front/fonte/rotas.js`.

| Tela | Hash |
| --- | --- |
| Login | `#/login` |
| Painel | `#/inicio` |
| Caixa de e-mail | `#/caixa-email` |
| Histórico | `#/historico` |
| Processos | `#/processos` |
| Candidatos | `#/candidatos` |
| Pipeline | `#/pipeline-candidatos` |
| Novo processo | `#/novo-processo` |
| Detalhes do processo | `#/detalhes-processo` |
| Entrevistas | `#/entrevistas` |
| Banco de talentos | `#/banco-talentos` |
| Configuração | `#/configuracao` |
| Candidato | `#/candidato` |
| Prova | `#/prova` |
| Conclusão | `#/conclusao` |
| Resultado | `#/resultado` |
| Análise | `#/analise-candidatos` |
| Candidatura pública | `#/candidatar/{slug}` |

## Menu lateral

O menu lateral é definido em `Front/fonte/ui/components/layout.js`.

Itens visíveis:

- Painel;
- E-mails;
- Histórico;
- Processos;
- Candidatos;
- Entrevistas;
- Análise;
- Banco de talentos.

Atalhos:

- Novo processo;
- Nova prova.

## Tela inicial

A tela inicial consolida:

- últimos testes/histórico;
- processos em andamento;
- resumo da caixa de currículos;
- navegação para ações principais.

## Caixa de e-mail

Implementada dentro de `features/gestao/index.js` como seção reutilizável em modo resumo ou completo. Usa paginação, filtros, ações de análise, vínculo, banco de talentos, ignorar e excluir.

## Processos

A tela de processos fica em `features/processos/index.js`. Ela cuida de:

- lista de processos;
- criação/edição;
- detalhe;
- candidatos vinculados;
- pré-análises de CV;
- entrevistas no processo;
- ações por candidato;
- textos públicos da vaga.

## Prova

A prova fica em `features/prova/index.js`, com apoio de:

- `perguntas.js`;
- `regras-prova.js`;
- `features/prova/services/excel-base-data.js`;
- arquivos em `Front/Exames/`.

## Serviços API do frontend

| Arquivo | Responsabilidade |
| --- | --- |
| `auth.js` | Login e sessão |
| `core.js` | Requisições, token, cache e erro comum |
| `history.js` | Histórico e gabaritos |
| `processes.js` | Processos, candidatos, CVs, e-mail, banco talentos |
| `interviews.js` | Slots e entrevistas |
| `pipeline.js` | Pipeline de candidatos |
| `analytics.js` | Relatórios e análises |
| `public-candidacy.js` | Candidatura pública |

## Cuidados ao alterar o frontend

1. Evite mexer em `controlador-aplicacao.js` sem necessidade: ele concentra fluxo e estado.
2. Ao mudar um nome de campo retornado pela API, ajuste todos os consumidores em `features/*`.
3. Ao mexer em layout, teste tela pequena e tela grande.
4. Ao mexer na prova, teste fluxo completo: candidato → prova → conclusão → resultado → histórico.
5. Ao mexer na caixa de e-mail, teste e-mail sem anexo, com anexo inválido e com CV válido.
