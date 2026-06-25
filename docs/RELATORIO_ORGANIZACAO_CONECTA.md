# Relatório de organização controlada do Conecta

Data da consolidação: 24/06/2026.

## Resultado

A raiz foi consolidada sem apagar dados reais. O backend funcional foi migrado
de `api/` para `apps/backend/`; o frontend funcional foi migrado de `Front/`
para `apps/frontend/`; e a árvore paralela `fonte/` foi preservada em
`_legacy/fonte/`.

## Inventário inicial da raiz

Pastas encontradas:

- `.agents/`, `.github/`, `.venv/`;
- `api/`, `apps/`, `data/`, `docs/`, `fonte/`, `Front/`, `infra/`,
  `tools/`.

Arquivos encontrados:

- `.dockerignore`, `.env`, `.env.example`, `.gitignore`;
- `CHANGELOG.md`, `CONTRIBUTING.md`, `pytest.ini`;
- `README.md`, `README_GITHUB.md`, `requirements.txt`;
- `run.py`, `start_conecta.ps1`.

Não havia dois arquivos `.env` distintos: havia um `.env` local e um
`.env.example`. O `.env` não é rastreado.

## Classificação

- `api/`: backend funcional, não obsoleto; migrado para `apps/backend/rh_api`,
  com testes em `apps/backend/tests`.
- `apps/backend/`: esqueleto arquitetural parcialmente integrado; tornou-se o
  backend oficial e recebeu o código funcional.
- `Front/`: frontend funcional; migrado integralmente para `apps/frontend/`.
- `apps/frontend/src/`: esqueleto não executável; preservado em
  `_legacy/apps/frontend-src-skeleton/`.
- `fonte/`: cópia antiga divergente. Dos 59 arquivos, 25 eram idênticos aos
  equivalentes do frontend ativo e 34 divergiam; toda a árvore foi preservada em
  `_legacy/fonte/`.
- `data/`: contém fixtures versionadas, dados privados locais ignorados e banco
  Access legado ignorado. Nada foi apagado.
- `tools/`: contém o importador de provas reformuladas; foi mantido e seu caminho
  padrão foi atualizado.
- `run.py`: inicializador Python; mantido e ajustado ao entrypoint canônico.
- `start_conecta.ps1`: inicializador Windows; mantido.
- `infra/`: já separava Docker, SQL e scripts; foi mantido.
- `docs/`: mantido, com runbooks e backup consolidados em `docs/operacao/`.

## Estrutura final da raiz

```text
.
├── .agents/
├── .github/
├── .venv/                 # local, ignorada
├── _legacy/
├── apps/
│   ├── backend/
│   └── frontend/
├── data/
├── docs/
├── infra/
│   ├── docker/
│   ├── scripts/
│   └── sql/
├── tools/
├── .dockerignore
├── .env                   # local, ignorado
├── .env.example
├── .gitignore
├── CHANGELOG.md
├── CONTRIBUTING.md
├── pytest.ini
├── README.md
├── README_GITHUB.md
├── requirements.txt
├── run.py
└── start_conecta.ps1
```

## Arquivos e pastas movidos

- `api/rh_api/` → `apps/backend/rh_api/`;
- `api/tests/` → `apps/backend/tests/`;
- `api/app.py` → `apps/backend/app.py`;
- `apps/backend/src/conecta/` → `apps/backend/conecta/`;
- conteúdo executável de `Front/` → `apps/frontend/`;
- `docs/runbooks/incidentes.md` → `docs/operacao/incidentes.md`;
- `docs/banco/backup-restore.md` → `docs/operacao/backup-restore.md`.

Todas essas cópias foram verificadas por hash antes da remoção das árvores de
origem.

## Itens preservados em legado

- `_legacy/api/README.md` e `_legacy/api/requirements.txt`;
- `_legacy/Front/README.md`;
- `_legacy/fonte/`, cópia divergente completa;
- `_legacy/apps/backend-src-package/`;
- `_legacy/apps/frontend-src-skeleton/`.

Nenhum item de `_legacy/` participa do runtime, testes ou imagens Docker.

## Arquivos renomeados ou já padronizados

Os nomes solicitados já estavam padronizados no início desta consolidação:
`README.md`, `README_GITHUB.md`, `CHANGELOG.md`, `CONTRIBUTING.md`,
`requirements.txt`, `pytest.ini`, `run.py` e `start_conecta.ps1`.

## Segredos, ambiente virtual e temporários

- `.env` está ignorado e não aparece em `git ls-files`;
- exemplos seguros existem na raiz e em cada aplicação;
- `.venv/` está ignorada e não é rastreada;
- `.venv.zip` e `api/__pycache__/app.cpython-313.pyc` já estavam marcados para
  remoção do versionamento e não foram restaurados;
- `__pycache__`, `.pytest_cache`, `node_modules`, `dist`, `build`, logs,
  bancos locais e dados privados estão cobertos pelos arquivos de ignore;
- currículos e anexos reais encontrados em `data/private/` foram removidos do
  índice com `git rm --cached`, preservados localmente e continuam ignorados.

## Caminhos e automação atualizados

- entrypoint: `conecta.interfaces.http.main:app`;
- configuração do frontend: `apps/frontend`;
- testes: `apps/backend/tests`;
- Dockerfiles copiam somente as árvores oficiais;
- workflows validam `apps/backend` e `apps/frontend`;
- o importador em `tools/` aponta para o banco de questões no novo caminho.

## Validação executada

- linha de base antes da migração: 73 testes Python aprovados;
- depois da migração: 73 testes Python aprovados;
- import do entrypoint canônico e `run.py --help`: aprovados;
- `/health`, `/version`, `/docs`, `/openapi.json`, `/runtime-config.js`, `/`,
  `/index.html` e `/fonte/principal.js`: HTTP 200 no cliente de testes;
- `/ready`: HTTP 503 porque o SQL Server não estava disponível;
- referências de scripts, imports ESM e recursos do `index.html`: nenhuma ausência;
- cinco smoke tests JavaScript aprovados;
- navegador real não executado: o ambiente bloqueou `file://` e não autorizou o
  processo local em segundo plano;
- fluxos de login, processo, candidato, prova e entrevista: pendentes de uma
  validação integrada com SQL Server DEV disponível.

## Riscos e pendências manuais

- `rh_api/` continua como pacote de compatibilidade dentro do backend oficial.
  A migração domínio a domínio para `conecta/` pode continuar sem reintroduzir
  uma pasta `api/` na raiz.
- Documentos históricos em `docs/legacy/` preservam nomes antigos
  intencionalmente.
- Repetir os fluxos integrados com uma base SQL Server de DEV controlada.
- Executar `docker compose ... up --build` no ambiente de integração; o Docker
  está instalado, mas as imagens não foram construídas nesta auditoria.
- Revisar `_legacy/` antes de qualquer remoção definitiva futura.
