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

test('Phase 10 E2E: CRM 360 Timeline, Asset Permanent History, Service Catalog & PO Linked to OS', async (t) => {
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

  // 1. Register Tenant A
  const regRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      ownerName: 'Gestor CRM',
      organizationName: `Org CRM ${suffix}`,
      email: `p10-${suffix}@test.local`,
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

  // 2. Service Catalog CRUD
  const srvRes = await app.inject({
    method: 'POST',
    url: '/api/v1/service-catalog',
    headers,
    payload: {
      name: 'Troca de Tela Notebook 15.6',
      category: 'notebook',
      defaultLaborCents: 18000,
      estimatedCostCents: 2000,
      defaultWarrantyDays: 90,
      estimatedHours: 2,
    },
  });
  assert.equal(srvRes.statusCode, 201);
  assert.equal(srvRes.json().code, 'SRV-001');

  const listSrv = await app.inject({
    method: 'GET',
    url: '/api/v1/service-catalog',
    headers,
  });
  assert.equal(listSrv.statusCode, 200);
  assert.equal(listSrv.json().length, 1);

  // 3. Customer, VIP Asset & OS
  const custRes = await app.inject({
    method: 'POST',
    url: '/api/v1/customers',
    headers,
    payload: {
      type: 'PF',
      name: 'Maria Cliente 360',
      phoneE164: '+5511944443333',
    },
  });
  assert.equal(custRes.statusCode, 201);
  const customer = custRes.json();

  const assetRes = await app.inject({
    method: 'POST',
    url: '/api/v1/assets',
    headers,
    payload: {
      customerId: customer.id,
      category: 'notebook',
      brand: 'Lenovo',
      model: 'IdeaPad 3',
      acquiredFromStore: true,
      vipDiscountPct: 20,
    },
  });
  assert.equal(assetRes.statusCode, 201);
  const asset = assetRes.json();

  const osRes = await app.inject({
    method: 'POST',
    url: '/api/v1/service-orders',
    headers,
    payload: {
      customerId: customer.id,
      assetId: asset.id,
      priority: 'HIGH',
      reportedSymptoms: 'Tela trincada precisa de pedido de peça.',
      notifyWhatsapp: false,
    },
  });
  assert.equal(osRes.statusCode, 201);
  const os = osRes.json();

  // 4. Purchase Order linked to OS moves OS to AWAITING_PART, and Receiving moves to IN_REPAIR
  const supRes = await app.inject({
    method: 'POST',
    url: '/api/v1/inventory/suppliers',
    headers,
    payload: { name: 'bringIT B2B', leadTimeDays: 3 },
  });
  assert.equal(supRes.statusCode, 201);
  const supplier = supRes.json();

  const prodRes = await app.inject({
    method: 'POST',
    url: '/api/v1/inventory/products',
    headers,
    payload: {
      sku: `TELA-${suffix}`,
      name: 'Tela 15.6 FHD IPS 30p',
      category: 'notebook',
      costCents: 32000,
      priceCents: 52000,
      stockQty: 0,
      minStockQty: 1,
    },
  });
  assert.equal(prodRes.statusCode, 201);
  const product = prodRes.json();

  const expectedIso = new Date(Date.now() + 3 * 86400000).toISOString();
  const poRes = await app.inject({
    method: 'POST',
    url: '/api/v1/inventory/purchase-orders',
    headers,
    payload: {
      supplierId: supplier.id,
      linkedServiceOrderId: os.id,
      expectedArrivalAt: expectedIso,
      items: [{ productId: product.id, quantity: 1, unitCostCents: 32000 }],
    },
  });
  assert.equal(poRes.statusCode, 201);
  const po = poRes.json();

  const osWhileWaiting = await app.inject({
    method: 'GET',
    url: `/api/v1/service-orders/${os.id}`,
    headers,
  });
  assert.equal(osWhileWaiting.json().os.status, 'AWAITING_PART');
  assert.ok(osWhileWaiting.json().os.promisedAt);

  const recvRes = await app.inject({
    method: 'POST',
    url: `/api/v1/inventory/purchase-orders/${po.id}/receive`,
    headers,
  });
  assert.equal(recvRes.statusCode, 201);

  const osAfterArrival = await app.inject({
    method: 'GET',
    url: `/api/v1/service-orders/${os.id}`,
    headers,
  });
  assert.equal(osAfterArrival.json().os.status, 'IN_REPAIR');

  // 5. Customer 360 Timeline & Asset Permanent History
  const timelineRes = await app.inject({
    method: 'GET',
    url: `/api/v1/customers/${customer.id}/timeline`,
    headers,
  });
  assert.equal(timelineRes.statusCode, 200);
  const timeline = timelineRes.json();
  assert.equal(timeline.stats.assetsCount, 1);
  assert.equal(timeline.stats.vipAssetsCount, 1);
  assert.equal(timeline.stats.ordersCount, 1);

  const assetHistRes = await app.inject({
    method: 'GET',
    url: `/api/v1/assets/${asset.id}/history`,
    headers,
  });
  assert.equal(assetHistRes.statusCode, 200);
  assert.equal(assetHistRes.json().orders.length, 1);
});
