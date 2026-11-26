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

test('Phase 8 E2E: VIP Store Assets, Bench Timers, Digital Signature & B2B vs Marketplace Sourcing', async (t) => {
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

  // 1. Register Tenant A and Tenant B
  const regARes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      ownerName: 'Gestor VIP',
      organizationName: `Org VIP ${suffix}`,
      email: `p8-a-${suffix}@test.local`,
      password: 'Password@123',
      enabledModules: ['core', 'mod-service-orders', 'mod-inventory-pos'],
    },
  });
  assert.equal(regARes.statusCode, 201);
  const tenantA = regARes.json();
  createdOrgIds.push(tenantA.user.organizationId);
  const headersA = { authorization: `Bearer ${tenantA.accessToken}` };

  const regBRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      ownerName: 'Outro Tenant',
      organizationName: `Org Outro ${suffix}`,
      email: `p8-b-${suffix}@test.local`,
      password: 'Password@123',
      enabledModules: ['core', 'mod-service-orders', 'mod-inventory-pos'],
    },
  });
  assert.equal(regBRes.statusCode, 201);
  const tenantB = regBRes.json();
  createdOrgIds.push(tenantB.user.organizationId);
  const headersB = { authorization: `Bearer ${tenantB.accessToken}` };

  // 2. Customer + VIP Store Asset + OS
  const custRes = await app.inject({
    method: 'POST',
    url: '/api/v1/customers',
    headers: headersA,
    payload: {
      type: 'PF',
      name: 'Cliente PC Loja',
      phoneE164: '+5511966665555',
    },
  });
  assert.equal(custRes.statusCode, 201);
  const customer = custRes.json();

  const assetRes = await app.inject({
    method: 'POST',
    url: '/api/v1/assets',
    headers: headersA,
    payload: {
      customerId: customer.id,
      category: 'desktop',
      brand: 'Custom AL',
      model: 'Workstation Ryzen 7',
      acquiredFromStore: true,
      storeSaleRef: 'NF-8801',
      vipDiscountPct: 25,
    },
  });
  assert.equal(assetRes.statusCode, 201);
  const asset = assetRes.json();
  assert.equal(asset.acquiredFromStore, true);
  assert.equal(asset.vipDiscountPct, 25);

  const osRes = await app.inject({
    method: 'POST',
    url: '/api/v1/service-orders',
    headers: headersA,
    payload: {
      customerId: customer.id,
      assetId: asset.id,
      priority: 'HIGH',
      reportedSymptoms: 'Revisão preventiva anual VIP.',
      notifyWhatsapp: false,
    },
  });
  assert.equal(osRes.statusCode, 201);
  const os = osRes.json();

  const osDetailRes = await app.inject({
    method: 'GET',
    url: `/api/v1/service-orders/${os.id}`,
    headers: headersA,
  });
  assert.equal(osDetailRes.statusCode, 200);
  assert.equal(osDetailRes.json().asset.acquiredFromStore, true);
  assert.equal(osDetailRes.json().asset.vipDiscountPct, 25);

  // 3. Bench Timer: start active -> switch wait_part -> stop
  const t1 = await app.inject({
    method: 'POST',
    url: `/api/v1/service-orders/${os.id}/timers/start`,
    headers: headersA,
    payload: { mode: 'active_bench', note: 'Inspecionando fonte' },
  });
  assert.equal(t1.statusCode, 201);

  const t2 = await app.inject({
    method: 'POST',
    url: `/api/v1/service-orders/${os.id}/timers/start`,
    headers: headersA,
    payload: { mode: 'wait_part', note: 'Aguardando SSD' },
  });
  assert.equal(t2.statusCode, 201);

  const tStop = await app.inject({
    method: 'POST',
    url: `/api/v1/service-orders/${os.id}/timers/stop`,
    headers: headersA,
  });
  assert.equal(tStop.statusCode, 201);
  assert.equal(tStop.json().stoppedCount, 1);

  const timersList = await app.inject({
    method: 'GET',
    url: `/api/v1/service-orders/${os.id}/timers`,
    headers: headersA,
  });
  assert.equal(timersList.statusCode, 200);
  assert.equal(timersList.json().entries.length, 2);
  assert.equal(timersList.json().runningEntry, null);

  // 4. Canvas Digital Signature
  const sigRes = await app.inject({
    method: 'POST',
    url: `/api/v1/service-orders/${os.id}/signature`,
    headers: headersA,
    payload: {
      signatureDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    },
  });
  assert.equal(sigRes.statusCode, 201);
  assert.ok(sigRes.json().signatureSignedAt);

  // 5. Sourcing Price Comparator: B2B Distributor vs Marketplace PF
  const cotRes = await app.inject({
    method: 'POST',
    url: '/api/v1/sourcing/requests',
    headers: headersA,
    payload: {
      itemName: 'SSD NVMe 1TB Kingston NV2',
      desiredQty: 2,
      targetResalePriceCents: 54900,
      urgency: 'normal',
    },
  });
  assert.equal(cotRes.statusCode, 201);
  const cot = cotRes.json();

  const b2bRes = await app.inject({
    method: 'POST',
    url: `/api/v1/sourcing/requests/${cot.id}/offers`,
    headers: headersA,
    payload: {
      channelType: 'supplier_b2b',
      vendorName: 'Distribuidora B2B Atacado',
      unitPriceCents: 34500,
      shippingCents: 4200,
      taxOrFeeCents: 1800,
      deliveryDays: 4,
    },
  });
  assert.equal(b2bRes.statusCode, 201);
  assert.equal(b2bRes.json().landedUnitCostCents, 37500);

  const mktRes = await app.inject({
    method: 'POST',
    url: `/api/v1/sourcing/requests/${cot.id}/offers`,
    headers: headersA,
    payload: {
      channelType: 'marketplace_pf',
      vendorName: 'Mercado Livre Full PF',
      unitPriceCents: 33800,
      shippingCents: 0,
      taxOrFeeCents: 0,
      deliveryDays: 1,
    },
  });
  assert.equal(mktRes.statusCode, 201);
  const mktOffer = mktRes.json();
  assert.equal(mktOffer.landedUnitCostCents, 33800);

  const listSourcingA = await app.inject({
    method: 'GET',
    url: '/api/v1/sourcing/requests',
    headers: headersA,
  });
  assert.equal(listSourcingA.statusCode, 200);
  const firstCot = listSourcingA.json()[0];
  assert.equal(firstCot.comparison.cheaperChannel, 'marketplace_pf');
  assert.equal(firstCot.comparison.savingsCents, 3700);

  const aiRecRes = await app.inject({
    method: 'POST',
    url: `/api/v1/sourcing/requests/${cot.id}/ai-recommend`,
    headers: headersA,
  });
  assert.equal(aiRecRes.statusCode, 201);
  assert.ok(aiRecRes.json().recommendation.includes('Marketplace PF'));

  const selRes = await app.inject({
    method: 'PATCH',
    url: `/api/v1/sourcing/requests/${cot.id}/select/${mktOffer.id}`,
    headers: headersA,
  });
  assert.equal(selRes.statusCode, 200);
  assert.equal(selRes.json().status, 'DECIDED');

  // Cross-tenant isolation check on Sourcing
  const listSourcingB = await app.inject({
    method: 'GET',
    url: '/api/v1/sourcing/requests',
    headers: headersB,
  });
  assert.equal(listSourcingB.statusCode, 200);
  assert.equal(listSourcingB.json().length, 0);
});
