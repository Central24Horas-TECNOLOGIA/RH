# Testes E2E (Playwright)

Suíte de testes end-to-end para o frontend do Conecta, usando
[Playwright](https://playwright.dev/). Roda o app real (backend FastAPI
servindo o frontend estático, mesma origem) dentro de um navegador
Chromium controlado.

## Instalação

```powershell
cd apps/frontend
npm install
npx playwright install chromium
```

`npx playwright install chromium` baixa o binário do navegador (não vem
com o pacote npm). É preciso rodar isso pelo menos uma vez por máquina/CI.

## Rodando os testes

```powershell
npm run test:e2e             # roda tudo, headless
npm run test:e2e:headed      # roda com navegador visível
npm run test:e2e:ui          # abre a UI interativa do Playwright
npm run test:e2e:report      # abre o último relatório HTML gerado
```

Por padrão (`playwright.config.js`), o Playwright sobe o backend
automaticamente antes dos testes (`python run.py --no-reload --port 8000`,
a partir da raiz do repositório) e derruba ao final — não é preciso
iniciar o servidor manualmente. Se você já tem o servidor rodando (ex.:
`python run.py` em outro terminal), defina `E2E_SKIP_WEBSERVER=1` para
usar o servidor existente em vez de subir um novo:

```powershell
$env:E2E_SKIP_WEBSERVER = "1"
npm run test:e2e
```

O backend sobe sem exigir um banco de dados real: o bootstrap de schema
falha de forma tolerante (apenas loga erro) quando não há SQL Server
acessível, e a tela de login/assets estáticos continuam funcionando. Isso
é suficiente para o smoke test de login, mas qualquer chamada de API que
dependa de dados reais (login efetivo, listagem de candidatos, etc.) não
vai funcionar sem um banco configurado.

## Estrutura

- `login.spec.js` — smoke test da tela de login. **Não depende de
  autenticação** e roda de ponta a ponta em qualquer ambiente, incluindo
  CI, sem configuração extra.
- `authenticated-flows.spec.js` — fluxos que exigem uma sessão
  autenticada (navegação entre telas, CRUD de candidatos, Kanban,
  testes DISC/fit cultural/raciocínio lógico, configurações). Ver
  limitação abaixo.
- `fixtures/auth.js` — fixture `authenticatedPage` usada pelos testes
  autenticados.

## Limitação conhecida: login via Microsoft SSO

O Conecta usa **exclusivamente Microsoft SSO** (OAuth "authorization code
flow") para autenticação — não existe login local por usuário/senha até
que o SSO Microsoft falhe uma vez (fallback visual, mas ainda exige
credenciais reais de um usuário cadastrado). Isso significa que:

- **Não é possível automatizar um login real** neste ambiente de
  desenvolvimento/CI: não há credenciais de um usuário de teste Microsoft
  disponíveis, e não seria correto commitar credenciais reais no
  repositório.
- Não existe hoje, no backend (`apps/backend/rh_api/routers/auth.py`),
  nenhuma rota que emita uma sessão autenticada sem passar pelo fluxo
  OAuth real — nem mesmo em modo de desenvolvimento. Os testes de backend
  que "logam" (`apps/backend/tests/test_microsoft_auth.py`) só conseguem
  fazer isso porque usam `TestClient` do FastAPI com um repositório fake
  injetado via `dependency_overrides`, um mecanismo que só existe dentro
  do processo de teste Python — não é acessível a partir de um navegador
  real conversando por HTTP com um servidor rodando de verdade.

Por isso, todos os testes em `authenticated-flows.spec.js` usam a fixture
`authenticatedPage` (`fixtures/auth.js`), que:

1. Verifica a variável de ambiente `E2E_AUTH_BYPASS`.
2. Se **não** estiver definida (o caso padrão sempre, hoje), o teste é
   **pulado** (`test.skip`) com uma mensagem explicativa — ele aparece
   como "skipped" no relatório, não como falha.
3. Se estiver definida, a fixture tentaria usar um mecanismo real de
   sessão de teste — que **ainda não existe** no backend. A fixture lança
   um erro claro nesse caso em vez de fingir sucesso.

**Isso é intencional.** Não foi criado nenhum bypass de autenticação real
"de mentira" embutido no código de produção só para fazer os testes
passarem — isso seria um risco de segurança. Os testes autenticados foram
escritos com os seletores e rotas reais da aplicação (baseados na leitura
do código-fonte atual) e ficam prontos para rodar assim que existir um
jeito seguro de autenticar em CI.

### Como habilitar os testes autenticados no futuro

Se o time quiser rodar `authenticated-flows.spec.js` de ponta a ponta em
CI, as opções mais razoáveis são:

1. **Um usuário de teste Microsoft real** (conta de serviço dedicada em um
   tenant de testes do Azure AD), usando a `storageState` do Playwright
   para gravar a sessão uma vez e reutilizá-la — mais fiel ao fluxo real,
   mas depende de infraestrutura Azure AD de teste.
2. **Uma rota de bypass explícita, dev/CI-only, no backend** — por
   exemplo, `POST /auth/dev-login` que só existe quando
   `RH_APP_ENV != "prod"` **e** uma flag de configuração dedicada está
   ativa, emitindo uma sessão para um usuário de teste fixo. Precisaria
   ser implementada com cuidado (nunca acessível em produção, auditada,
   documentada) — isso é uma decisão de segurança do time de backend, não
   algo que deveria ser adicionado silenciosamente só para testes E2E
   passarem.

Qualquer uma das duas opções deve ser implementada e revisada
separadamente; este trabalho de infraestrutura de testes deliberadamente
não faz isso.

## Rodando em CI

Exemplo de step de CI (GitHub Actions):

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 20
- run: npm install
  working-directory: apps/frontend
- run: npx playwright install --with-deps chromium
  working-directory: apps/frontend
- run: npm run test:e2e
  working-directory: apps/frontend
  env:
    CI: "true"
```

Como `authenticated-flows.spec.js` fica pulado sem `E2E_AUTH_BYPASS`, o
job de CI vai reportar sucesso com vários testes "skipped" até que a
autenticação de teste seja resolvida (ver seção acima).
