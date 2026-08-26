// @ts-check
const { test, expect } = require('./fixtures/auth');

/**
 * Fluxos autenticados principais do Conecta.
 *
 * IMPORTANTE: o login é feito exclusivamente via Microsoft SSO (OAuth), e
 * não há nenhum mecanismo de bypass de autenticação implementado no
 * backend hoje (nem mesmo em desenvolvimento). Por isso, todos os testes
 * abaixo usam a fixture `authenticatedPage` (tests-e2e/fixtures/auth.js),
 * que os pula automaticamente com uma mensagem clara enquanto a variável
 * de ambiente E2E_AUTH_BYPASS não apontar para um mecanismo real de sessão
 * de teste (dev/CI only). Ver tests-e2e/README.md para o plano de como
 * habilitar isso no futuro sem comprometer a segurança de produção.
 *
 * Os testes foram escritos com os seletores e rotas reais do app (ver
 * fonte/rotas.js e os componentes de cada feature) para que, assim que a
 * autenticação de teste existir, baste remover o skip condicional.
 */

test.describe('Navegação entre telas principais', () => {
  test('menu lateral navega entre início, processos e candidatos', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#screen-menu')).toBeVisible();

    await page.getByRole('link', { name: /processos/i }).first().click();
    await expect(page.locator('#screen-processes')).toBeVisible();

    await page.getByRole('link', { name: /candidatos/i }).first().click();
    await expect(page.locator('#screen-candidates')).toBeVisible();
  });

  test('acessa o dashboard de funil de processos', async ({ authenticatedPage: page }) => {
    await page.goto('/processos/dashboard-funil');
    await expect(page.locator('#screen-dashboard-funil')).toBeVisible();
  });

  test('acessa a agenda/calendário', async ({ authenticatedPage: page }) => {
    await page.goto('/calendario');
    await expect(page.locator('#screen-calendario')).toBeVisible();
  });
});

test.describe('Candidatos', () => {
  test('cria um novo candidato pelo formulário', async ({ authenticatedPage: page }) => {
    await page.goto('/candidatos');
    await page.getByRole('button', { name: /novo candidato/i }).click();

    await page.getByLabel(/nome/i).fill('Candidato Teste E2E');
    await page.getByLabel(/e-?mail/i).fill('candidato.teste.e2e@example.com');
    await page.getByRole('button', { name: /salvar/i }).click();

    await expect(page.getByText('Candidato Teste E2E')).toBeVisible();
  });

  test('edita um candidato existente e persiste a alteração', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/candidatos');
    await page.getByRole('row').filter({ hasText: 'Candidato Teste E2E' }).first().click();

    await page.getByRole('button', { name: /editar/i }).click();
    await page.getByLabel(/telefone/i).fill('11999999999');
    await page.getByRole('button', { name: /salvar/i }).click();

    await expect(page.getByText('11999999999')).toBeVisible();
  });
});

test.describe('Pipeline (Kanban)', () => {
  test('move um card de candidato entre colunas do Kanban por drag-and-drop', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/pipeline-candidatos');

    const card = page.locator('[data-kanban-card]').first();
    const colunaDestino = page.locator('[data-kanban-coluna]').nth(1);

    await expect(card).toBeVisible();
    await card.dragTo(colunaDestino);

    await expect(colunaDestino).toContainText(await card.textContent());
  });

  test('abre os detalhes de um processo a partir do pipeline', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/pipeline-candidatos');
    await page.locator('[data-kanban-card]').first().click();

    await expect(page.locator('#screen-process-details')).toBeVisible();
  });
});

test.describe('Testes de avaliação (DISC, fit cultural, raciocínio lógico)', () => {
  test('aplica o teste DISC e envia as respostas', async ({ authenticatedPage: page }) => {
    await page.goto('/disc-teste/candidato-teste-e2e');

    const perguntas = page.locator('[data-disc-pergunta]');
    const total = await perguntas.count();
    for (let i = 0; i < total; i += 1) {
      await perguntas.nth(i).locator('input[type="radio"]').first().check();
    }

    await page.getByRole('button', { name: /enviar|concluir/i }).click();
    await expect(page.getByText(/obrigado|concluído/i)).toBeVisible();
  });

  test('aplica o teste de fit cultural', async ({ authenticatedPage: page }) => {
    await page.goto('/fit-cultural-teste/candidato-teste-e2e');
    await expect(page.locator('#screen-fit-cultural-teste')).toBeVisible();
  });

  test('aplica o teste de raciocínio lógico', async ({ authenticatedPage: page }) => {
    await page.goto('/raciocinio-teste/candidato-teste-e2e');
    await expect(page.locator('#screen-raciocinio-teste')).toBeVisible();
  });
});

test.describe('Configurações administrativas', () => {
  test('lista usuários do sistema em configurações', async ({ authenticatedPage: page }) => {
    await page.goto('/configuracoes/usuario');
    await expect(page.locator('#screen-settings-users')).toBeVisible();
  });
});
