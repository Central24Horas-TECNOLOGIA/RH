// @ts-check
const base = require('@playwright/test');

/**
 * Fixture de autenticação para testes E2E.
 *
 * O Conecta usa exclusivamente Microsoft SSO (OAuth "authorization code
 * flow") para login real — ver apps/backend/rh_api/routers/auth.py e
 * apps/frontend/fonte/features/gestao/index.js (TelaLogin). Automatizar o
 * fluxo Microsoft de ponta a ponta não é viável neste ambiente de teste.
 *
 * Por isso, os testes E2E que dependem de sessão autenticada usam a rota
 * `POST /auth/e2e-login` (apps/backend/rh_api/routers/auth.py), que só
 * responde quando AMBAS as condições são verdadeiras:
 *
 *   1. o backend não está em produção (`settings.is_production` é falso);
 *   2. a variável de ambiente RH_E2E_TEST_LOGIN_SECRET foi definida
 *      explicitamente no backend, e o valor de E2E_AUTH_BYPASS aqui bate
 *      com ela.
 *
 * Sem essas duas condições, a rota responde 404 (não 403, para não revelar
 * nem a existência do mecanismo em produção) — daí este fixture, ao ver
 * E2E_AUTH_BYPASS ausente, continuar pulando o teste com uma mensagem clara
 * em vez de tentar autenticar e falhar de forma confusa.
 *
 * Achado QA-001/S-23 do programa de evolução do Conecta
 * (docs/connecta-evolution/) — ver também routers/auth.py::e2e_test_login.
 */

const AUTH_BYPASS_ENV_VAR = 'E2E_AUTH_BYPASS';
const AUTH_BYPASS_USER_ENV_VAR = 'E2E_AUTH_BYPASS_USUARIO';
const AUTH_BYPASS_ROLE_ENV_VAR = 'E2E_AUTH_BYPASS_PERFIL';

function authBypassConfigured() {
  return Boolean(process.env[AUTH_BYPASS_ENV_VAR]);
}

/**
 * Autentica a página chamando a rota real de bypass de teste do backend
 * (POST /auth/e2e-login) e gravando a sessão retornada em sessionStorage,
 * exatamente como fonte/services/api/core.js (salvarSessaoAutenticacao)
 * faz após um login real — para que o app não perceba diferença nenhuma.
 */
async function applyAuthBypass(page, _context) {
  if (!authBypassConfigured()) {
    throw new Error(
      `${AUTH_BYPASS_ENV_VAR} não configurado — não há como autenticar neste ambiente.`,
    );
  }

  const resposta = await page.request.post('/auth/e2e-login', {
    data: {
      secret: process.env[AUTH_BYPASS_ENV_VAR],
      usuario: process.env[AUTH_BYPASS_USER_ENV_VAR] || 'e2e.teste',
      perfil: process.env[AUTH_BYPASS_ROLE_ENV_VAR] || 'administrador',
    },
  });

  if (!resposta.ok()) {
    throw new Error(
      `Falha ao autenticar via /auth/e2e-login (status ${resposta.status()}). ` +
        'Confirme que RH_E2E_TEST_LOGIN_SECRET no backend bate com E2E_AUTH_BYPASS aqui, ' +
        'e que o backend não está rodando com RH_APP_ENV=production.',
    );
  }

  const sessao = await resposta.json();

  // Precisa navegar antes de poder gravar sessionStorage na origem certa.
  await page.goto('/');
  await page.evaluate((dadosSessao) => {
    sessionStorage.setItem('rh_api_access_token', dadosSessao.access_token || '');
    sessionStorage.setItem('rh_api_authenticated_user', dadosSessao.usuario || '');
    sessionStorage.setItem(
      'rh_api_session_payload',
      JSON.stringify({
        usuario: dadosSessao.usuario || '',
        nome: dadosSessao.nome || '',
        email: dadosSessao.email || '',
        perfil: dadosSessao.perfil || '',
        perfil_nome: dadosSessao.perfil_nome || '',
        nivel: dadosSessao.nivel || '',
        permissoes: Array.isArray(dadosSessao.permissoes) ? dadosSessao.permissoes : [],
        avatar_ilustrado: dadosSessao.avatar_ilustrado || '',
      }),
    );
  }, sessao);
}

/**
 * Extende o `test` do Playwright com uma fixture `authenticatedPage` que
 * pula automaticamente (com mensagem clara) quando não há como autenticar
 * neste ambiente, e aplica o bypass real quando E2E_AUTH_BYPASS está
 * configurado.
 */
const test = base.test.extend({
  authenticatedPage: async ({ page, context }, use, testInfo) => {
    if (!authBypassConfigured()) {
      testInfo.skip(
        true,
        'Login real depende de Microsoft SSO, que não pode ser automatizado neste ambiente. ' +
          `Defina ${AUTH_BYPASS_ENV_VAR} com o mesmo valor de RH_E2E_TEST_LOGIN_SECRET do ` +
          'backend (dev/hml/CI apenas) para habilitar este teste. Veja tests-e2e/README.md.',
      );
      return;
    }
    await applyAuthBypass(page, context);
    await use(page);
  },
});

module.exports = {
  test,
  expect: base.expect,
  authBypassConfigured,
  AUTH_BYPASS_ENV_VAR,
  AUTH_BYPASS_USER_ENV_VAR,
  AUTH_BYPASS_ROLE_ENV_VAR,
};
