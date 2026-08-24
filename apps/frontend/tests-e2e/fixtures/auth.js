// @ts-check
const base = require('@playwright/test');

/**
 * Fixture de autenticação para testes E2E.
 *
 * O Conecta usa exclusivamente Microsoft SSO (OAuth "authorization code
 * flow") para login — ver apps/backend/rh_api/routers/auth.py e
 * apps/frontend/fonte/features/gestao/index.js (TelaLogin). Não existe hoje
 * nenhuma rota de backend que emita uma sessão autenticada sem passar pelo
 * fluxo real da Microsoft, nem mesmo em ambiente de desenvolvimento — os
 * testes de backend (apps/backend/tests/test_microsoft_auth.py) só
 * conseguem "logar" porque usam TestClient do FastAPI com um repositório
 * fake injetado via dependency override, o que só é possível dentro do
 * próprio processo de teste Python, não contra um servidor HTTP real.
 *
 * Por isso, os testes E2E que dependem de sessão autenticada usam esta
 * fixture `authenticatedPage`. Ela:
 *
 *   1. Lê a variável de ambiente E2E_AUTH_BYPASS.
 *   2. Se não estiver definida (o caso padrão hoje, sempre), pula o teste
 *      com `test.skip()` e uma mensagem explicando o motivo — o teste NÃO
 *      falha, apenas fica marcado como "skipped" no relatório.
 *   3. Se estiver definida, espera-se que aponte para um mecanismo real de
 *      injeção de sessão de teste exposto pelo backend SOMENTE em ambiente
 *      de desenvolvimento/CI (nunca em produção) — por exemplo, uma rota
 *      protegida por uma flag de configuração que emite um cookie de sessão
 *      válido para um usuário de teste. Esse mecanismo ainda não existe no
 *      backend atual e NÃO deve ser criado como bypass "de mentira": se for
 *      implementado no futuro, deve ser uma rota real, auditável, restrita
 *      a RH_APP_ENV != "prod" e documentada em
 *      apps/backend/rh_api/routers/auth.py.
 *
 * Isso garante que nenhum bypass de autenticação de produção seja simulado
 * ou inventado apenas para fazer os testes "passarem".
 */

const AUTH_BYPASS_ENV_VAR = 'E2E_AUTH_BYPASS';

function authBypassConfigured() {
  return Boolean(process.env[AUTH_BYPASS_ENV_VAR]);
}

/**
 * Aplica uma sessão de teste autenticada na página, usando o mecanismo
 * apontado por E2E_AUTH_BYPASS. Lança erro se chamado sem a variável
 * configurada — sempre verifique `authBypassConfigured()` (ou use a
 * fixture `authenticatedPage`) antes de chamar isto diretamente.
 */
async function applyAuthBypass(_page, _context) {
  if (!authBypassConfigured()) {
    throw new Error(
      `${AUTH_BYPASS_ENV_VAR} não configurado — não há como autenticar neste ambiente.`,
    );
  }
  // Ponto de extensão: quando o backend expuser um mecanismo real de sessão
  // de teste (dev/CI apenas), a lógica de injeção de cookie/sessão deve
  // entrar aqui. Hoje isso não existe, então este ramo nunca é alcançado
  // pelos testes (authBypassConfigured() é sempre false por padrão).
  throw new Error(
    `${AUTH_BYPASS_ENV_VAR} está definido, mas nenhum mecanismo de bypass de autenticação ` +
      'está implementado neste projeto ainda. Veja tests-e2e/fixtures/auth.js.',
  );
}

/**
 * Extende o `test` do Playwright com uma fixture `authenticatedPage` que
 * pula automaticamente (com mensagem clara) quando não há como autenticar
 * neste ambiente.
 */
const test = base.test.extend({
  authenticatedPage: async ({ page, context }, use, testInfo) => {
    if (!authBypassConfigured()) {
      testInfo.skip(
        true,
        'Login real depende de Microsoft SSO, que não pode ser automatizado neste ambiente. ' +
          `Defina ${AUTH_BYPASS_ENV_VAR} (com um mecanismo de sessão de teste dev/CI-only, ` +
          'ainda não implementado no backend) para habilitar este teste. Veja tests-e2e/README.md.',
      );
      return;
    }
    await applyAuthBypass(page, context);
    await use(page);
  },
});

module.exports = { test, expect: base.expect, authBypassConfigured, AUTH_BYPASS_ENV_VAR };
