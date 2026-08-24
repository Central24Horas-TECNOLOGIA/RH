// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const path = require('node:path');

/**
 * Configuração do Playwright para os testes E2E do Conecta.
 *
 * O Conecta é servido como um único processo: o backend FastAPI (rh_api)
 * serve o frontend estático (apps/frontend) na mesma origem, por padrão em
 * http://127.0.0.1:8000 (ver run.py e apps/backend/rh_api/config.py).
 *
 * Login é feito exclusivamente via Microsoft SSO (OAuth), então testes que
 * dependem de sessão autenticada não conseguem completar o fluxo de login
 * real neste ambiente (não há um usuário de teste Microsoft disponível em
 * CI/sandbox). Esses testes usam a fixture `authenticatedPage` (ver
 * tests-e2e/fixtures/auth.js), que só funciona se a variável de ambiente
 * E2E_AUTH_BYPASS estiver configurada apontando para um mecanismo de sessão
 * de teste — caso contrário, eles são pulados (test.skip) com uma mensagem
 * explicando o motivo. Veja tests-e2e/README.md para detalhes.
 */

const PORT = Number(process.env.E2E_PORT || 8000);
const BASE_URL = process.env.E2E_BASE_URL || `http://127.0.0.1:${PORT}`;
const REPO_ROOT = path.resolve(__dirname, '..', '..');

module.exports = defineConfig({
  testDir: './tests-e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],
  // O frontend é um SPA sem bundler (dezenas de módulos ESM buscados
  // individualmente no primeiro load), então damos uma margem maior que o
  // padrão do Playwright antes de considerar um teste travado.
  timeout: 45_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Sobe o backend (que também serve o frontend estático) automaticamente
  // antes dos testes, e derruba ao final. Desative com E2E_SKIP_WEBSERVER=1
  // caso já tenha um servidor rodando localmente (ex.: `python run.py`).
  webServer: process.env.E2E_SKIP_WEBSERVER
    ? undefined
    : {
        command: `python run.py --no-reload --port ${PORT}`,
        cwd: REPO_ROOT,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
        env: {
          // Ambiente mínimo para o processo subir sem exigir banco de dados
          // real ou segredos de produção. O bootstrap de schema falha de
          // forma tolerante (apenas loga erro) quando não há SQL Server
          // acessível, então a tela de login e os assets estáticos
          // continuam funcionando mesmo sem banco configurado.
          RH_APP_ENV: process.env.RH_APP_ENV || 'development',
          FLASK_SECRET_KEY:
            process.env.FLASK_SECRET_KEY || 'e2e-playwright-local-secret-not-for-prod',
          RH_AUTH_TOKEN_SECRET:
            process.env.RH_AUTH_TOKEN_SECRET ||
            'e2e-playwright-local-auth-secret-not-for-prod-32c',
        },
      },
});
