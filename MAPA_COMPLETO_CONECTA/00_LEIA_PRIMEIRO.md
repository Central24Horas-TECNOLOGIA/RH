# Mapa Completo Conecta - leia primeiro

Data da auditoria: 2026-07-10  
Ambiente analisado: Conecta local em `http://127.0.0.1:8000`, ambiente HML, usuario com perfil Administrador.

## Objetivo

Este conjunto de documentos mapeia o Conecta como produto, ferramenta operacional de RH e experiencia de uso. O foco esta em telas, navegacao, campos, botoes, regras visiveis, fluxos, dados, estados, problemas e melhorias. Nao foram feitas alteracoes no sistema nem em dados de negocio.

## Escopo

Foram analisadas as areas internas do RH, o menu lateral, rotas de processos, e-mails, candidatos, entrevistas, banco de talentos, provas, relatorios, configuracoes, logs, tela de login, acesso negado e entrada publica de prova. A rota publica de candidatura foi identificada, mas nao havia link publico ativo no processo observado.

## Forma de analise

- Navegacao real pelo navegador local autenticado.
- Chamadas de leitura da API local para confirmar volumes, status e campos visiveis.
- Leitura dos textos e componentes do frontend apenas como apoio para nao omitir elementos.
- Teste responsivo em 1366x768, 1024x768, 768x1024 e 390x844.
- Acoes destrutivas ou com efeito operacional nao foram executadas: excluir, encerrar, aprovar, eliminar, salvar, criar, enviar, cancelar e reabrir foram apenas documentadas.

## Estado analisado

| Item                                  | Quantidade observada |
| ------------------------------------- | -------------------: |
| Processos abertos retornados          |                    1 |
| Candidatos em processos retornados    |                    4 |
| Itens no banco de talentos retornados |                    1 |
| Entrevistas retornadas                |                    1 |
| Slots de entrevista retornados        |                   25 |
| E-mails recentes retornados           |                   10 |
| Perfis retornados                     |                    6 |
| Permissoes retornadas                 |                   87 |
| Usuarios retornados                   |                    1 |
| Logs retornados                       |                   62 |
| Historico de provas retornado         |                    1 |
| Provas geradas retornadas             |                    4 |

## Indice das pastas

- `01_VISAO_GERAL`: mapa macro, arquitetura funcional, navegacao e relacionamento entre modulos.
- `02_TELAS`: inventario de telas, estrutura visual, wireframes e analise por tela.
- `03_ELEMENTOS`: campos, botoes, formularios, tabelas, filtros, modais, menus, indicadores e componentes.
- `04_FLUXOS`: fluxos principais, secundarios, jornadas de RH e candidato, processos seletivos e diagramas.
- `05_REGRAS`: regras de negocio, status, permissoes, validacoes e dependencias.
- `06_DADOS`: inventario de informacoes, origem/destino, relacoes e ciclo de dados.
- `07_DESIGN_E_USABILIDADE`: design atual, padroes, inconsistencias, responsividade, usabilidade e acessibilidade.
- `08_AUDITORIA`: testes realizados, funcionalidades operantes, problemas, itens nao testados e riscos.
- `09_MELHORIAS`: backlog, prioridades, melhorias por tela, fluxo e oportunidades.
- `10_MATRIZES`: rastreabilidade, telas/elementos, regras/fluxos e impactos.

## Legendas

Prioridade: Critico, Alto, Medio, Baixo, Opcional.  
Status de teste: Funciona, Parcial, Confuso, Erro, Nao testado.  
Fonte: Observado na UI, Confirmado por leitura da API, Inferido por comportamento/tela.

## Limitacoes

- A base possuia poucos registros; alguns estados vazios e cenarios de volume nao puderam ser provados.
- Link publico de candidatura estava inativo/ausente no processo observado.
- Acoes com risco de alterar dados foram evitadas.
- Alguns modais foram documentados por leitura de tela e componentes, nao por envio de formulario.
- O relatorio usa nomes reais encontrados na interface; quando uma rota redirecionou, isso esta indicado.

## Resumo executivo

O Conecta esta organizado em um fluxo central de recrutamento: e-mail e candidatura alimentam candidatos; candidatos entram em processos; processos conduzem triagem, entrevista, prova, decisao final e banco de talentos; configuracoes governam usuarios, permissoes, catalogos e logs. O produto ja possui boa cobertura funcional para operacao de RH, mas apresenta pontos de atencao em consistencia de nomenclatura de status, rotas legadas que redirecionam, algumas acoes com impacto alto que precisam de confirmacoes claras e densidade visual elevada em telas operacionais.

## Contagem final da auditoria

| Categoria                              | Quantidade documentada |
| -------------------------------------- | ---------------------: |
| Telas/rotas analisadas                 |                     24 |
| Elementos identificados                |                    186 |
| Campos identificados                   |                     74 |
| Botoes/acoes identificados             |                     79 |
| Formularios documentados               |                     14 |
| Modais documentados                    |                     13 |
| Regras de negocio documentadas         |                     31 |
| Fluxos documentados                    |                     24 |
| Status documentados                    |                     22 |
| Problemas consolidados                 |                     18 |
| Melhorias sugeridas                    |                     29 |
| Areas nao acessadas plenamente         |                      3 |
| Funcionalidades nao testadas por risco |                     17 |
