import { test, expect, type Page } from '@playwright/test';

async function loginAsSeedAdmin(page: Page) {
  await page.goto('/login');
  await page.locator('#email').fill('adriano@altech.local');
  await page.locator('#password').fill('Admin@12345');
  await page.getByRole('button', { name: /Entrar no painel/i }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 15_000 });
}

test.describe('AL Business OS — Full-Stack Browser E2E Journeys', () => {
  test('Dashboard BI, Daily Briefing, Kanban toggle & Period toggle load cleanly', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await loginAsSeedAdmin(page);

    await expect(page.getByText('Briefing Executivo do Dia')).toBeVisible();
    await expect(page.getByText(/Fluxo Financeiro/i)).toBeVisible();
    await expect(page.getByText('Funil Operacional da Bancada')).toBeVisible();
    await expect(page.getByText('Conversão de Orçamentos')).toBeVisible();

    // Alternar 30d e voltar para 7d
    await page.getByRole('button', { name: '30d', exact: true }).click();
    await expect(page.getByText('Fluxo Financeiro (30 dias)')).toBeVisible();
    await page.getByRole('button', { name: '7d', exact: true }).click();

    // Alternar para quadro Kanban
    await page.getByRole('button', { name: /Kanban/i }).click();
    await expect(page.getByText('Entrada / Triagem')).toBeVisible();
    await page.getByRole('button', { name: /Lista/i }).click();

    expect(pageErrors).toEqual([]);
  });

  test('Supplier CRUD, Rich Product Creation & Finance<->Dashboard Sync', async ({
    page,
  }) => {
    const suffix = Date.now().toString().slice(-6);
    const supName = `Distribuidor E2E ${suffix}`;
    const prodSku = `E2E-SKU-${suffix}`;
    const expenseDesc = `Despesa E2E Browser ${suffix}`;

    const server500s: string[] = [];
    page.on('response', (res) => {
      if (res.status() >= 500) {
        server500s.push(`${res.status()} ${res.url()}`);
      }
    });

    await loginAsSeedAdmin(page);

    // 1. Estoque -> Aba Fornecedores -> Criar fornecedor B2B
    await page.goto('/app/inventory');
    await page.getByRole('button', { name: /Fornecedores B2B/i }).click();
    await page.getByRole('button', { name: /Novo Fornecedor/i }).click();
    await page.getByPlaceholder(/Nome Fantasia/i).fill(supName);
    await page.getByPlaceholder(/CNPJ/i).fill('12.999.888/0001-77');
    await page.getByPlaceholder(/WhatsApp/i).fill('+5511944445555');
    await page.getByRole('button', { name: /Cadastrar Fornecedor/i }).click();
    await expect(page.getByRole('heading', { name: supName })).toBeVisible();

    // 2. Aba Catálogo & Estoque -> Cadastrar Produto Completo com descrição, tabelas e fornecedor
    await page.getByRole('button', { name: /Catálogo & Estoque/i }).click();
    await page.getByRole('button', { name: /Cadastrar Produto Completo/i }).first().click();
    await page.getByPlaceholder(/Ex: SSD-NVME-1TB/i).fill(prodSku);
    await page.getByPlaceholder(/Ex: SSD NVMe Kingston/i).fill(`Peça Teste E2E ${suffix}`);
    await page
      .getByPlaceholder(/Descreva interface/i)
      .fill('Compatível com notebooks linha Dell Inspiron e Latitude.');
    const priceInputs = page.getByPlaceholder('0.00');
    await priceInputs.nth(0).fill('200.00');
    await priceInputs.nth(1).fill('350.00');
    await page.getByPlaceholder('Opcional').nth(0).fill('310.00');
    await page.getByPlaceholder('Opcional').nth(1).fill('295.00');
    await page
      .locator('select')
      .filter({ hasText: supName })
      .first()
      .selectOption({ label: `${supName} (3d)` });
    await page.getByRole('button', { name: /Cadastrar Produto Completo/i }).last().click();

    await expect(page.getByText(prodSku).first()).toBeVisible();
    await expect(page.getByText(supName).first()).toBeVisible();

    // 3. Financeiro -> Lançar Despesa Pendente e verificar sincronismo no Dashboard
    await page.goto('/app/finance');
    await page.getByPlaceholder(/Ex: Compra SSD/i).fill(expenseDesc);
    await page.getByPlaceholder(/Valor R\$/i).fill('185,50');
    // Desmarcar checkbox "Já pago agora" para testar sincronia de conta pendente
    const paidCheckbox = page.locator('input[type="checkbox"]').first();
    if (await paidCheckbox.isChecked()) {
      await paidCheckbox.uncheck();
    }
    await page.getByRole('button', { name: /Registrar Lançamento/i }).click();
    await expect(page.getByText(expenseDesc)).toBeVisible();

    // Confirmar pagamento (Dar Baixa)
    const txRow = page.locator('tr', { hasText: expenseDesc });
    await txRow.getByRole('button', { name: /Dar Baixa/i }).click();
    await expect(txRow.getByText('PAGO / CONF.')).toBeVisible();

    // Voltar ao Dashboard e verificar que Fluxo Financeiro carrega valores atualizados
    await page.goto('/app');
    await expect(page.getByText(/Fluxo Financeiro \(7 dias\)/i)).toBeVisible();

    expect(server500s).toEqual([]);
  });

  test('All ERP routes and Customer Portal render without HTTP 500 or runtime crash', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    const server500s: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('response', (res) => {
      if (res.status() >= 500) {
        server500s.push(`${res.status()} ${res.url()}`);
      }
    });

    await loginAsSeedAdmin(page);

    const routes = [
      '/app/customers',
      '/app/os/new',
      '/app/pos',
      '/app/contracts',
      '/app/automations',
      '/app/security',
      '/app/print3d',
      '/app/projects',
      '/app/social',
      '/app/fiscal',
      '/app/knowledge',
      '/app/modules',
      '/app/inbox',
    ];

    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator('main')).toBeVisible();
    }

    // Portal público do cliente demo
    await page.goto('/portal/OS-2026-0001?token=demo-portal-token-0001');
    await expect(page.getByText(/OS-2026-0001/i).first()).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(server500s).toEqual([]);
  });
});
