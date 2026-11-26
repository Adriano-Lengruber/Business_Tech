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

test('Phase 3 E2E: Inventory, Purchase Order Receive, POS Sale, OS Part Consumption & Fiscal AI Rejection', async (t) => {
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

  // 1. Register tenant WITHOUT mod-inventory-pos
  const regRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      ownerName: 'Gestor Loja',
      organizationName: `Loja P3 ${suffix}`,
      email: `p3-${suffix}@test.local`,
      password: 'Password@123',
      enabledModules: ['core', 'mod-service-orders', 'mod-finance-fiscal'],
    },
  });
  assert.equal(regRes.statusCode, 201);
  const tenant = regRes.json();
  createdOrgIds.push(tenant.user.organizationId);
  const auth = { authorization: `Bearer ${tenant.accessToken}` };

  // 2. Inventory blocked when module disabled
  const invBlocked = await app.inject({
    method: 'GET',
    url: '/api/v1/inventory/products',
    headers: auth,
  });
  assert.equal(invBlocked.statusCode, 403);

  // Enable mod-inventory-pos
  await app.inject({
    method: 'PATCH',
    url: '/api/v1/modules/mod-inventory-pos',
    headers: auth,
    payload: { enabled: true },
  });

  // 3. Create Product, Supplier & Purchase Order -> Receive increments stock & creates payable
  const prodRes = await app.inject({
    method: 'POST',
    url: '/api/v1/inventory/products',
    headers: auth,
    payload: {
      sku: `SSD-${suffix}`,
      name: 'SSD NVMe 1TB Teste',
      costCents: 25000,
      priceCents: 42000,
      stockQty: 2,
      minStockQty: 3,
      ncm: '84717040',
    },
  });
  assert.equal(prodRes.statusCode, 201);
  const product = prodRes.json();
  assert.equal(product.alertLevel, 'LOW_STOCK');

  const supRes = await app.inject({
    method: 'POST',
    url: '/api/v1/inventory/suppliers',
    headers: auth,
    payload: { name: 'Fornecedor E2E', leadTimeDays: 2 },
  });
  const supplier = supRes.json();

  const poRes = await app.inject({
    method: 'POST',
    url: '/api/v1/inventory/purchase-orders',
    headers: auth,
    payload: {
      supplierId: supplier.id,
      items: [{ productId: product.id, quantity: 3, unitCostCents: 25000 }],
    },
  });
  assert.equal(poRes.statusCode, 201);
  const po = poRes.json();

  const receiveRes = await app.inject({
    method: 'POST',
    url: `/api/v1/inventory/purchase-orders/${po.id}/receive`,
    headers: auth,
  });
  assert.equal(receiveRes.statusCode, 201);
  assert.equal(receiveRes.json().status, 'RECEIVED');

  // Stock should now be 2 + 3 = 5 (OK)
  const listAfterReceive = await app.inject({
    method: 'GET',
    url: '/api/v1/inventory/products',
    headers: auth,
  });
  assert.equal(listAfterReceive.json()[0].stockQty, 5);
  assert.equal(listAfterReceive.json()[0].alertLevel, 'OK');

  // 4. POS Sale: oversell rejected (400), valid sale deducts stock and records confirmed receivable
  const oversellRes = await app.inject({
    method: 'POST',
    url: '/api/v1/pos/sales',
    headers: auth,
    payload: {
      paymentMethod: 'pix',
      items: [{ productId: product.id, quantity: 10 }],
    },
  });
  assert.equal(oversellRes.statusCode, 400);

  const saleRes = await app.inject({
    method: 'POST',
    url: '/api/v1/pos/sales',
    headers: auth,
    payload: {
      paymentMethod: 'pix',
      discountCents: 2000,
      paidImmediately: true,
      items: [{ productId: product.id, quantity: 2 }],
    },
  });
  assert.equal(saleRes.statusCode, 201);
  const sale = saleRes.json().sale;
  assert.equal(sale.totalCents, 82000); // 2 * 42000 - 2000

  // 5. Consume 1 part inside a Service Order -> stock becomes 5 - 2 - 1 = 2
  const custRes = await app.inject({
    method: 'POST',
    url: '/api/v1/customers',
    headers: auth,
    payload: { type: 'PF', name: 'Cliente Peça', phoneE164: '11977776666' },
  });
  const osRes = await app.inject({
    method: 'POST',
    url: '/api/v1/service-orders',
    headers: auth,
    payload: {
      customerId: custRes.json().id,
      reportedSymptoms: 'Upgrade de SSD',
      notifyWhatsapp: false,
    },
  });
  const os = osRes.json();

  const consumeRes = await app.inject({
    method: 'POST',
    url: `/api/v1/service-orders/${os.id}/consume-part`,
    headers: auth,
    payload: { productId: product.id, quantity: 1 },
  });
  assert.equal(consumeRes.statusCode, 201);
  assert.equal(consumeRes.json().product.stockQty, 2);

  // 6. Fiscal Emission (Authorized + Simulated Rejection + AI Diagnostic)
  const nfeAuthRes = await app.inject({
    method: 'POST',
    url: '/api/v1/fiscal/documents',
    headers: auth,
    payload: {
      docType: 'NFCE',
      referenceType: 'sale',
      referenceId: sale.id,
    },
  });
  assert.equal(nfeAuthRes.statusCode, 201);
  assert.equal(nfeAuthRes.json().status, 'AUTHORIZED');
  assert.ok(nfeAuthRes.json().accessKey);

  const nfeRejRes = await app.inject({
    method: 'POST',
    url: '/api/v1/fiscal/documents',
    headers: auth,
    payload: {
      docType: 'NFE',
      referenceType: 'sale',
      referenceId: sale.id,
      simulateRejection: true,
    },
  });
  assert.equal(nfeRejRes.statusCode, 201);
  assert.equal(nfeRejRes.json().status, 'REJECTED');

  const diagFiscalRes = await app.inject({
    method: 'POST',
    url: `/api/v1/fiscal/documents/${nfeRejRes.json().id}/diagnose-rejection`,
    headers: auth,
  });
  assert.equal(diagFiscalRes.statusCode, 201);
  assert.ok(diagFiscalRes.json().aiDiagnosticHint.length > 10);

  // 7. Finance summary reflects POS sale (82000 confirmed) and Purchase Order (75000 payable)
  const finSummary = await app.inject({
    method: 'GET',
    url: '/api/v1/finance/summary',
    headers: auth,
  });
  assert.equal(finSummary.json().confirmedReceivableCents, 82000);
  assert.equal(finSummary.json().payableCents, 75000);
  assert.equal(finSummary.json().netCashflowCents, 7000);
});
