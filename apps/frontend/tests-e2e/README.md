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

## Login via Microsoft SSO e o bypass de teste (achado QA-001/S-23)

O Conecta usa **exclusivamente Microsoft SSO** (OAuth "authorization code
flow") para login real — não existe login local por usuário/senha até
que o SSO Microsoft falhe uma vez (fallback visual, mas ainda exige
credenciais reais de um usuário cadastrado). **Não é possível automatizar
um login real** neste ambiente de desenvolvimento/CI: não há credenciais
de um usuário de teste Microsoft disponíveis, e não seria correto
commitar credenciais reais no repositório.

Por isso, o backend expõe `POST /auth/e2e-login`
(`apps/backend/rh_api/routers/auth.py::e2e_test_login`) — uma rota de
bypass de autenticação **restrita à suíte de testes**, que só responde
quando **ambas** as condições abaixo são verdadeiras:

1. o backend não está em produção (`settings.is_production` é falso —
   ver `RH_APP_ENV`);
2. a variável de ambiente `RH_E2E_TEST_LOGIN_SECRET` foi definida
   explicitamente no backend (vazia por padrão em **todo** ambiente,
   inclusive dev), e o segredo enviado na requisição bate com ela.

Sem as duas condições, a rota responde `404` — não `403` — para não
revelar nem a existência do mecanismo fora de um ambiente onde ele deve
estar ativo. **Isso não é um bypass "de mentira": é uma rota real,
auditável (gera log de warning e entrada normal de auditoria de login),
gated por configuração explícita, que nunca fica acessível em produção
mesmo que alguém tente.**

A fixture `authenticatedPage` (`fixtures/auth.js`):

1. Verifica a variável de ambiente `E2E_AUTH_BYPASS` (o segredo, do lado
   do Playwright).
2. Se **não** estiver definida (o padrão em qualquer ambiente que não
   configurou o bypass explicitamente), o teste é **pulado**
   (`test.skip`) com mensagem explicativa — aparece como "skipped" no
   relatório, não como falha.
3. Se estiver definida, chama `POST /auth/e2e-login` com esse segredo e
   grava a sessão retornada em `sessionStorage`, exatamente como o app
   faz após um login real — o app não percebe diferença nenhuma.

### Como habilitar os testes autenticados

Defina, no **mesmo processo/ambiente do backend** e no ambiente onde o
Playwright roda, o mesmo valor de segredo:

```powershell
# backend (antes de subir o servidor)
$env:RH_E2E_TEST_LOGIN_SECRET = "um-segredo-só-para-CI-dev"

# Playwright (mesmo valor)
$env:E2E_AUTH_BYPASS = "um-segredo-só-para-CI-dev"
npm run test:e2e
```

Opcionalmente, `E2E_AUTH_BYPASS_USUARIO` e `E2E_AUTH_BYPASS_PERFIL`
controlam o nome de usuário e o perfil RBAC (`administrador` por padrão;
use `rh`, `gestor`, `dp` etc. para testar limites de permissão
específicos).

**Nunca defina `RH_E2E_TEST_LOGIN_SECRET` em produção.** A checagem
`settings.is_production` já bloqueia a rota mesmo que a variável exista,
mas o segredo não deveria estar configurado lá de forma alguma.

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
    RH_E2E_TEST_LOGIN_SECRET: ${{ secrets.E2E_TEST_LOGIN_SECRET }}
    E2E_AUTH_BYPASS: ${{ secrets.E2E_TEST_LOGIN_SECRET }}
```

`RH_E2E_TEST_LOGIN_SECRET` precisa chegar ao **processo do backend**
(`python run.py`, subido automaticamente pelo `playwright.config.js`) — se
o backend for iniciado num step/processo separado do CI, defina a mesma
variável lá também. Sem `E2E_AUTH_BYPASS`/`RH_E2E_TEST_LOGIN_SECRET`
configurados, `authenticated-flows.spec.js` continua pulado (skipped, não
falho) normalmente.
