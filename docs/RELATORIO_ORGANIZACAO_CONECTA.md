# Relatório de organização do Conecta/RH

Data da auditoria inicial: 21/06/2026.

## Escopo e premissas

Esta organização preserva o comportamento atual do Conecta/RH. Provas, banco de
questões, regras de aprovação/reprovação, status automáticos existentes, login,
entrevistas, banco de talentos e regras de processos não fazem parte da
refatoração. Nenhum item será apagado diretamente: descartáveis comprovados serão
movidos para `_quarentena_limpeza/`.

## O que foi encontrado

### Estrutura e inicialização

- `api/`: API FastAPI, repositórios SQL Server, serviços, schemas, routers e testes.
- `Front/`: interface ativa, carregada por `Front/index.html`; usa
  `Front/fonte/`, `Front/estilos/`, `Front/Exames/` e os bancos de questões em
  `Front/data/`.
- `data/`: dados privados/fixtures locais usados por funcionalidades e testes.
- `docs/`: documentação funcional, técnica e histórica.
- `tools/`: utilitários operacionais do projeto.
- `fonte/`: árvore paralela à `Front/fonte/`; 26 arquivos são iguais, 33 são
  diferentes e 8 existem apenas no Front ativo. Como o papel da árvore paralela
  não é inequívoco, ela será mantida.
- Entrada principal no Windows: `start_conecta.ps1`, que localiza a raiz pelo
  próprio script, prefere `.venv/Scripts/python.exe` e chama `run.py`.
- Entrada Python: `run.py`, que executa `api.app:app` por Uvicorn.
- Aplicação FastAPI: `api/rh_api/main.py`, criada por `create_app()` e exportada
  também por `api/app.py`.
- O backend já possui uma implementação segura de arquivos estáticos: registra
  todas as rotas da API antes do fallback do Front, preserva `/docs`,
  `/openapi.json` e endpoints existentes, e mantém `/Front` como compatibilidade.
  A padronização necessária é principalmente de configuração, porta e URL do
  cliente.

### Configuração

- A única leitura executável de `config.ini`/`configparser` está em
  `api/rh_api/config.py`.
- O arquivo procura `RH_CONFIG_INI`, `config.ini` na raiz e `config.ini` na pasta
  superior, além de combinar valores INI e ambiente.
- Existem `.env` local, `.env.example` versionado e `config.ini.example`
  versionado.
- `config.ini.example` contém valores com aparência de credencial real. Os
  valores não serão copiados nem documentados. A credencial deve ser rotacionada,
  pois remover o arquivo da versão atual não o remove do histórico do Git.
- `.env` será preservado e continuará fora do Git. Apenas nomes de variáveis e
  exemplos sem segredos serão publicados.
- Há defaults locais antigos de porta (8010/8081) e fallback do Front para uma
  origem fixa. O padrão solicitado será 127.0.0.1:8000 na mesma origem.

### Front e chamadas da API

- `Front/index.html` carrega `runtime-config.js` e `fonte/principal.js`.
- `Front/fonte/services/api/core.js` centraliza as requisições, mas contém um
  fallback local para porta fixa. Esse fallback será substituído pela origem da
  página, preservando override explícito por runtime config.
- Os módulos de tela usam o cliente centralizado; não é necessário reescrever
  telas ou rotas.

### Banco, candidatos, processos e currículos

- Processos usam `processos_seletivos` e candidatos vinculados usam
  `candidatos_processos`.
- Dados complementares do candidato usam `candidatos_metadata`, com `id_teste`
  como identificador textual existente.
- Currículos atuais usam `candidatos_anexos`, com vínculo por `id_teste`, processo,
  nome, tipo, caminho e tamanho do arquivo.
- A pré-análise atual usa `cv_pre_analises`; ela não será alterada nem reutilizada
  como decisão automática.
- Já existe extração de currículo em `api/rh_api/services/cv.py`, com suporte aos
  formatos atuais e testes em `api/tests/test_cv_extraction.py`. A nova IA
  reutilizará a extração existente e enviará apenas texto limitado e normalizado.
- O schema complementar é criado de forma idempotente em
  `api/rh_api/repositories/bootstrap.py`. A tabela nova seguirá o mesmo padrão,
  sem alterar tabelas antigas.
- As rotas existentes estão distribuídas entre `system`, `auth`, `history`,
  `email_inbox`, `generated_exams`, `processes`, `public_candidacy`, `interviews`,
  `analytics`, `pipeline` e `settings`. Nenhuma rota existente será renomeada.

### Itens descartáveis identificados

- Perfis temporários de navegador: `.edge-headless*`.
- Caches Python: `__pycache__/` sob `api/`.
- Temporários locais: `.pytest-tmp/` e `.pytest-email-tmp-1/`.
- Logs locais vazios `.codex-backend-8081.*.log`.
- Captura local `.edge-login.png`.
- Artefato de depuração `Front/debug-artifacts/`.
- `config.ini.example`, depois da migração de todas as informações úteis e da
  remoção da dependência de INI.

Não foram encontrados zips antigos, `.bak`, `.swp`, builds ou distribuições fora
dos perfis temporários acima. `api/tests/` e dados de teste referenciados serão
mantidos porque são necessários à validação de regressão.

## O que será mantido

- `api/`, `Front/`, `.git/`, `.venv/`, `.env`, `.env.example`, `.gitignore`,
  `requirements.txt`, `README.md`, `start_conecta.ps1`, `run.py`, scripts,
  documentação, migrations/bootstrap e SQL necessários.
- Todos os arquivos de provas, exames, banco de questões e regras de correção.
- Rotas, tabelas e regras de negócio existentes.
- `fonte/` e documentos potencialmente duplicados que possuam conteúdo diferente
  ou cujo uso não seja inequívoco.
- Fixtures e suítes de teste.

## O que será movido para quarentena

Os itens descartáveis comprovados serão preservados, conforme a categoria, em:

- `_quarentena_limpeza/caches/`
- `_quarentena_limpeza/logs_antigos/`
- `_quarentena_limpeza/arquivos_obsoletos/`
- `_quarentena_limpeza/pastas_teste/`

O arquivo `config.ini.example` será colocado em
`_quarentena_limpeza/arquivos_obsoletos/` somente depois da migração de suas
configurações úteis. Não há conteúdo seguro identificado para
`backups/` ou `zips_antigos/` nesta auditoria.

## O que será alterado

- `api/rh_api/config.py`: leitura exclusiva de `.env`/ambiente, tipos seguros e
  configurações opcionais da IA.
- `.env.example`: inventário completo sem valores reais.
- `.gitignore`: caches, logs, temporários, `.env` e quarentena.
- `run.py`, `start_conecta.ps1`, documentação e configuração do Front: padrão de
  um servidor em `http://127.0.0.1:8000`.
- Backend: serviço isolado de IA, validador de schema, repositório auditável,
  router dedicado e bootstrap idempotente de `analises_curriculo_ia`.
- Front: integração mínima na ficha do candidato, com habilitação consultada no
  backend, execução somente manual, histórico, reanálise e revisão humana.

## O que não deve ser alterado

- Banco de questões e provas de Excel, Word, gerais ou técnicas.
- Fluxo de prova, correção, aprovação/reprovação e status automáticos atuais.
- Login e modelo de autorização fora da nova permissão já existente de avaliação
  de currículo.
- Entrevistas, banco de talentos e tela de processos fora da leitura dos dados da
  vaga necessária ao prompt.
- Dados existentes, nomes de tabelas antigas, rotas existentes e layout geral.
- Credenciais reais ou arquivos de produção.

## Riscos identificados e mitigação

- **Credencial em exemplo versionado:** mover o arquivo não limpa o histórico;
  rotacionar a credencial e avaliar limpeza de histórico em procedimento separado.
- **Banco SQL Server indisponível no ambiente de teste:** o bootstrap já tolera
  falha de conexão na inicialização; testes unitários e de contrato devem usar
  mocks e a validação integrada deve ser repetida em ambiente com banco.
- **Identificador do candidato é textual (`id_teste`):** os novos endpoints
  aceitarão o identificador existente sem alterar schema legado, ainda que o nome
  conceitual da rota seja `id_candidato`.
- **Arquivos de currículo em caminhos legados:** a busca seguirá o repositório
  atual e validará existência/extensão antes da extração.
- **Resposta não confiável do provedor:** JSON será validado no backend, erros
  serão persistidos sem stack trace para o usuário e nenhuma análise atualizará
  status de candidato.
- **Chamadas duplicadas:** o botão será bloqueado durante a requisição e o backend
  terá proteção temporal contra chamadas concorrentes/acidentais.
- **Front servido por fallback catch-all:** routers continuarão registrados antes
  do fallback; OpenAPI e rotas conhecidas serão testados.

## Como testar depois

1. Instalar dependências e iniciar com `./start_conecta.ps1`.
2. Abrir `http://127.0.0.1:8000`, `/docs`, `/openapi.json`, `/api/status` e
   `/health`.
3. Efetuar login e validar carregamento de candidatos e processos.
4. Executar a suíte `pytest` e os smoke tests existentes do Front.
5. Validar que provas e banco de questões não tiveram diff e executar os testes
   específicos de provas geradas e correção Excel.
6. Confirmar que não existe referência executável a `config.ini`,
   `configparser`, 5500 ou 8011/8081.
7. Com `AI_ENABLED=false` e sem chave, confirmar que a API não chama provedor e
   que o botão fica oculto/desabilitado.
8. Com IA configurada em ambiente controlado, analisar currículo PDF/DOCX/TXT,
   consultar histórico, reanalisar, marcar revisão humana e conferir o registro
   auditável no banco.
9. Simular timeout, chave inválida e JSON inválido; a tela deve continuar
   funcional e o banco deve registrar o erro.
10. Confirmar que nenhuma dessas ações muda status, classificação, aprovação ou
    reprovação do candidato.

Este documento será atualizado ao final com o inventário efetivamente alterado e
movido.

## Resultado final da implementação

### Alterado

- `api/rh_api/config.py` passou a ler exclusivamente ambiente/`.env`, com
  booleanos e inteiros tipados, aliases de compatibilidade e defaults seguros.
- O login de fallback não aceita senha vazia.
- `.env.example` passou a documentar servidor único, banco, autenticação, e-mail,
  conversão de CV e IA sem valores reais.
- `config.ini.example` foi retirado do projeto ativo e preservado em quarentena.
- `Front/fonte/services/api/core.js` usa a origem atual da página; não há fallback
  ativo para 5500, 8011 ou 8081.
- `run.py` e `start_conecta.ps1` padronizam `127.0.0.1:8000`; o script Windows
  inicia um único servidor e exibe a URL.
- A aplicação registra todas as rotas antes do Front/fallback estático e preserva
  `/docs`, `/openapi.json`, `/api/status` e endpoints anteriores.
- Foram adicionados extração/sanitização para IA, prompt versionado
  `curriculo_ia_v1`, adaptador isolado de provedor, timeout, schema Pydantic,
  persistência, histórico, reanálise manual e revisão humana.
- O adaptador inicial usa OpenAI pelo backend com `httpx` já existente; nenhuma
  chave, prompt ou credencial é exposta no Front.
- A tabela `dbo.analises_curriculo_ia` e seus três índices são criados pelo
  bootstrap idempotente. O identificador do candidato é `NVARCHAR(120)` para
  respeitar o `id_teste` textual já usado pelo Conecta.
- Foram adicionadas as rotas:
  - `GET /curriculos-ia/configuracao`
  - `POST /curriculos/{id_candidato}/analisar-ia`
  - `GET /curriculos/{id_candidato}/analises-ia`
  - `GET /curriculos/{id_candidato}/analises-ia/ultima`
  - `POST /analises-curriculo-ia/{id_analise}/marcar-revisada`
- A ficha do candidato ganhou um painel pequeno de IA com aviso obrigatório,
  resultado estruturado, reanálise e revisão. Quando a IA está desativada ou sem
  chave/modelo, o botão não aparece.
- README, implantação e documentos técnicos ativos foram atualizados para `.env`
  e porta 8000.

### Movido para quarentena

Em 21/06/2026, a quarentena contém:

| Categoria | Itens diretos | Arquivos | Tamanho aproximado |
| --- | ---: | ---: | ---: |
| `caches/` | 11 | 1.764 | 63,3 MB |
| `logs_antigos/` | 4 | 4 | 9,3 KB |
| `arquivos_obsoletos/` | 2 | 2 | 556 KB |
| `pastas_teste/` | 4 | 201 | 8,8 KB |
| `backups/` | 0 | 0 | 0 |
| `zips_antigos/` | 0 | 0 | 0 |

Isso inclui perfis temporários do Edge, caches Python, temporários do pytest,
logs de validação, a captura local, o artefato `Front/debug-artifacts` e o exemplo
INI legado. Uma nova busca não encontrou caches/temporários equivalentes fora da
quarentena, `.git` e `.venv`.

### Mantido

- `api/` e `Front/` ativos, `.venv/`, `.env` local, scripts, SQL/bootstrap,
  fixtures, suíte de testes, documentação com conteúdo único e `fonte/`.
- Todos os exames, provas, bancos de questões e serviços de correção.
- Rotas, tabelas e dados legados, exceto a adição isolada da nova tabela.
- Regras de candidato, aprovação/reprovação, pipeline, entrevistas, login,
  processos e banco de talentos.

### Validação executada

- `61 passed` na suíte completa do backend.
- `7 passed` nos testes novos de IA (incluídos nos 61).
- Smoke de regras de negócio do Front aprovado.
- Todos os cenários existentes de correção Excel aprovados.
- Sintaxe dos arquivos JavaScript alterados validada.
- Servidor real iniciado em `http://127.0.0.1:8000` com bootstrap SQL concluído.
- Login real, painel inicial, lista de processos, candidatos e ficha do candidato
  carregados no navegador.
- Com `AI_ENABLED=false`, aviso humano visível, estado desativado visível e botão
  de chamada ausente.
- Swagger abriu; `/openapi.json` respondeu 200, contém a rota nova e preserva
  `/processes`.
- Nenhum erro de console foi observado na ficha validada.
- `analises_curriculo_ia` e índices foram criados pelo bootstrap sem alterar
  tabelas antigas.

Não foi feita chamada paga a um provedor externo porque a IA local está
desativada e nenhuma chave foi exposta. O contrato de chamada, bloqueio quando
desativada, validação do JSON e tratamento de erro foram cobertos por testes com
provedor controlado.

### Risco operacional remanescente

O exemplo INI versionado continha uma credencial com aparência real. O arquivo
atual foi removido e está ignorado na quarentena, mas o valor pode permanecer no
histórico Git. A credencial deve ser rotacionada e uma eventual limpeza de
histórico deve ser tratada em procedimento separado, com coordenação do
repositório remoto.
