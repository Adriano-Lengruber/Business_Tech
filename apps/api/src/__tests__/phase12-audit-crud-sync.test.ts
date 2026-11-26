import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Test } from '@nestjs/testing';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import multipart from '@fastify/multipart';
import { eq, organizations } from '@al/database';
import { AppModule } from '../app.module';
import { DatabaseService } from '../database/database.module';

test('Phase 12 E2E: Rich Product/Supplier CRUD, Finance<->Dashboard Sync, Customer Edit & Automations Delete', async (t) => {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );
  await app.register(multipart);
  app.setGlobalPrefix('api/v1');
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  const dbService = app.get(DatabaseService);
  const suffix = Date.now().toString();
  const createdOrgIds: string[] = [];

  t.after(async () => {
    for (const orgId of createdOrgIds) {
      await dbService.db
        .delete(organizations)
        .where(eq(organizations.id, orgId));
    }
    await app.close();
  });

  // 1. Register tenant with all required modules
  const regRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      ownerName: 'Auditor Phase12',
      organizationName: `Org Audit ${suffix}`,
      email: `p12-${suffix}@test.local`,
      password: 'Password@123',
      enabledModules: [
        'core',
        'mod-service-orders',
        'mod-inventory-pos',
        'mod-finance-fiscal',
      ],
    },
  });
  assert.equal(regRes.statusCode, 201);
  const auth = regRes.json();
  createdOrgIds.push(auth.user.organizationId);
  const headers = { authorization: `Bearer ${auth.accessToken}` };

  // 2. Supplier Full CRUD
  const supCreate = await app.inject({
    method: 'POST',
    url: '/api/v1/inventory/suppliers',
    headers,
    payload: {
      name: 'Fornecedor Alfa MEI',
      cnpj: '11.222.333/0001-44',
      phone: '+5511988887777',
      email: 'alfa@fornecedor.test',
      leadTimeDays: 2,
      websiteUrl: 'https://alfa.test',
      paymentTerms: 'PIX / Boleto 15d',
      acceptsMei: true,
      notes: 'Distribuidor de SSDs e baterias',
    },
  });
  assert.equal(supCreate.statusCode, 201);
  const supplier = supCreate.json();
  assert.equal(supplier.acceptsMei, true);

  const supCreate2 = await app.inject({
    method: 'POST',
    url: '/api/v1/inventory/suppliers',
    headers,
    payload: {
      name: 'Fornecedor Beta Backup',
      leadTimeDays: 5,
    },
  });
  assert.equal(supCreate2.statusCode, 201);
  const supplier2 = supCreate2.json();

  const supPatch = await app.inject({
    method: 'PATCH',
    url: `/api/v1/inventory/suppliers/${supplier.id}`,
    headers,
    payload: { leadTimeDays: 1, paymentTerms: 'PIX D+0' },
  });
  assert.equal(supPatch.statusCode, 200);
  assert.equal(supPatch.json().leadTimeDays, 1);

  // 3. Rich Product CRUD + Multi-tier pricing + Multi-supplier linkage + Kardex
  const prodRes = await app.inject({
    method: 'POST',
    url: '/api/v1/inventory/products',
    headers,
    payload: {
      sku: `SSD-${suffix}`,
      name: 'SSD NVMe 1TB Teste Completo',
      description: 'Leitura 6000MB/s com garantia de 1 ano',
      category: 'armazenamento',
      brand: 'Kingston',
      costCents: 30000,
      priceCents: 50000,
      wholesalePriceCents: 44000,
      vipPriceCents: 42000,
      warrantyDays: 365,
      preferredSupplierId: supplier.id,
      supplierSku: 'ALFA-NV3-1TB',
      stockQty: 4,
      minStockQty: 2,
      ncm: '84717040',
    },
  });
  assert.equal(prodRes.statusCode, 201);
  const product = prodRes.json();
  assert.equal(product.wholesalePriceCents, 44000);
  assert.equal(product.vipPriceCents, 42000);

  const linkRes = await app.inject({
    method: 'POST',
    url: `/api/v1/inventory/products/${product.id}/suppliers`,
    headers,
    payload: {
      supplierId: supplier2.id,
      supplierSku: 'BETA-1TB',
      lastCostCents: 31000,
      supplierUrl: 'https://beta.test/1tb',
      isPreferred: false,
    },
  });
  assert.equal(linkRes.statusCode, 201);

  const prodList = await app.inject({
    method: 'GET',
    url: '/api/v1/inventory/products',
    headers,
  });
  assert.equal(prodList.statusCode, 200);
  const foundProd = prodList.json().find((p: { id: string }) => p.id === product.id);
  assert.equal(foundProd.suppliers.length, 2);
  assert.equal(foundProd.preferredSupplierName, 'Fornecedor Alfa MEI');

  const movRes = await app.inject({
    method: 'GET',
    url: `/api/v1/inventory/products/${product.id}/movements`,
    headers,
  });
  assert.equal(movRes.statusCode, 200);
  assert.equal(movRes.json().length, 1);

  const prodPatch = await app.inject({
    method: 'PATCH',
    url: `/api/v1/inventory/products/${product.id}`,
    headers,
    payload: { vipPriceCents: 41000, warrantyDays: 180 },
  });
  assert.equal(prodPatch.statusCode, 200);
  assert.equal(prodPatch.json().vipPriceCents, 41000);

  const prodUnlink = await app.inject({
    method: 'DELETE',
    url: `/api/v1/inventory/products/${product.id}/suppliers/${supplier2.id}`,
    headers,
  });
  assert.equal(prodUnlink.statusCode, 200);

  const prodDelete = await app.inject({
    method: 'DELETE',
    url: `/api/v1/inventory/products/${product.id}`,
    headers,
  });
  assert.equal(prodDelete.statusCode, 200);

  const supDelete = await app.inject({
    method: 'DELETE',
    url: `/api/v1/inventory/suppliers/${supplier2.id}`,
    headers,
  });
  assert.equal(supDelete.statusCode, 200);

  // 4. Finance Expenses <-> Dashboard Analytics Sync Verification
  const todayIso = new Date().toISOString().slice(0, 10);

  // 4a. Create PENDING expense (e.g. default Finance launch)
  const expPendingRes = await app.inject({
    method: 'POST',
    url: '/api/v1/finance/transactions',
    headers,
    payload: {
      type: 'payable',
      category: 'Peças & Estoque',
      description: 'Despesa pendente teste sincronismo',
      paymentMethod: 'boleto',
      amountCents: 12345,
      dueDate: todayIso,
      paidImmediately: false,
    },
  });
  assert.equal(expPendingRes.statusCode, 201);
  const expPending = expPendingRes.json();
  assert.equal(expPending.status, 'PENDING');

  // 4b. Create CONFIRMED expense immediately
  const expPaidRes = await app.inject({
    method: 'POST',
    url: '/api/v1/finance/transactions',
    headers,
    payload: {
      type: 'payable',
      category: 'Energia',
      description: 'Despesa paga imediata',
      paymentMethod: 'pix',
      amountCents: 5000,
      dueDate: todayIso,
      paidImmediately: true,
    },
  });
  assert.equal(expPaidRes.statusCode, 201);
  assert.equal(expPaidRes.json().status, 'CONFIRMED');

  // Verify Dashboard Analytics shows BOTH paid (5000) and pending (12345) expenses!
  const dashRes = await app.inject({
    method: 'GET',
    url: '/api/v1/analytics/overview?days=7',
    headers,
  });
  assert.equal(dashRes.statusCode, 200);
  const dash = dashRes.json();
  assert.equal(dash.revenueSummary.totalExpenseCents, 5000);
  assert.equal(dash.revenueSummary.pendingExpenseCents, 12345);
  assert.equal(dash.revenueSummary.totalAllExpenseCents, 17345);
  const totalChartPendingExp = dash.dailyCashflow.reduce(
    (s: number, d: { pendingExpenseCents: number }) => s + d.pendingExpenseCents,
    0,
  );
  assert.equal(totalChartPendingExp, 12345);

  // Confirm pending expense -> moves from pending to realized on Dashboard too!
  const confirmRes = await app.inject({
    method: 'POST',
    url: `/api/v1/finance/transactions/${expPending.id}/confirm`,
    headers,
  });
  assert.equal(confirmRes.statusCode, 201);

  const dashAfterConfirm = (
    await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/overview?days=30',
      headers,
    })
  ).json();
  assert.equal(dashAfterConfirm.revenueSummary.totalExpenseCents, 17345);
  assert.equal(dashAfterConfirm.revenueSummary.pendingExpenseCents, 0);
  assert.equal(dashAfterConfirm.dailyCashflow.length, 30);

  // Cancel & Update transaction check
  const finPatch = await app.inject({
    method: 'PATCH',
    url: `/api/v1/finance/transactions/${expPaidRes.json().id}`,
    headers,
    payload: { description: 'Energia atualizada', amountCents: 5500 },
  });
  assert.equal(finPatch.statusCode, 200);
  assert.equal(finPatch.json().amountCents, 5500);

  const finCancel = await app.inject({
    method: 'DELETE',
    url: `/api/v1/finance/transactions/${expPaidRes.json().id}`,
    headers,
  });
  assert.equal(finCancel.statusCode, 200);
  assert.equal(finCancel.json().status, 'CANCELED');

  // 5. Customer PATCH & Soft DELETE
  const custCreate = await app.inject({
    method: 'POST',
    url: '/api/v1/customers',
    headers,
    payload: {
      type: 'PF',
      name: 'Cliente Para Editar',
      phoneE164: '+5511977776666',
    },
  });
  assert.equal(custCreate.statusCode, 201);
  const custId = custCreate.json().id;

  const custPatch = await app.inject({
    method: 'PATCH',
    url: `/api/v1/customers/${custId}`,
    headers,
    payload: { name: 'Cliente Editado PJ', type: 'PJ' },
  });
  assert.equal(custPatch.statusCode, 200);
  assert.equal(custPatch.json().name, 'Cliente Editado PJ');
  assert.equal(custPatch.json().type, 'PJ');

  const custDel = await app.inject({
    method: 'DELETE',
    url: `/api/v1/customers/${custId}`,
    headers,
  });
  assert.equal(custDel.statusCode, 200);
  assert.equal(custDel.json().archived, true);

  // 6. Automation Rule DELETE
  const ruleRes = await app.inject({
    method: 'POST',
    url: '/api/v1/automations/rules',
    headers,
    payload: {
      name: 'Regra Temporária E2E',
      triggerEvent: 'stock.low_alert',
      channel: 'internal_alert',
      delayHours: 0,
      templateText: 'Alerta teste',
    },
  });
  assert.equal(ruleRes.statusCode, 201);
  const ruleDel = await app.inject({
    method: 'DELETE',
    url: `/api/v1/automations/rules/${ruleRes.json().id}`,
    headers,
  });
  assert.equal(ruleDel.statusCode, 200);
  assert.equal(ruleDel.json().deleted, true);
});
