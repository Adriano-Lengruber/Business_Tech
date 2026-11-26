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

test('Phase 9 E2E: Category Checklists Closing Lock & Idempotent Event Automation Engine', async (t) => {
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
      ownerName: 'Gestor Qualidade',
      organizationName: `Org Qualidade ${suffix}`,
      email: `p9-a-${suffix}@test.local`,
      password: 'Password@123',
      enabledModules: ['core', 'mod-service-orders', 'mod-inventory-pos'],
    },
  });
  assert.equal(regARes.statusCode, 201);
  const tenantA = regARes.json();
  createdOrgIds.push(tenantA.user.organizationId);
  const headersA = { authorization: `Bearer ${tenantA.accessToken}` };

  // 2. Create Customer, OS & Mandatory Checklist Template
  const custRes = await app.inject({
    method: 'POST',
    url: '/api/v1/customers',
    headers: headersA,
    payload: {
      type: 'PF',
      name: 'Cliente Checklist Teste',
      phoneE164: '+5511955554444',
    },
  });
  assert.equal(custRes.statusCode, 201);
  const customer = custRes.json();

  const osRes = await app.inject({
    method: 'POST',
    url: '/api/v1/service-orders',
    headers: headersA,
    payload: {
      customerId: customer.id,
      priority: 'HIGH',
      reportedSymptoms: 'Não carrega bateria.',
      notifyWhatsapp: false,
    },
  });
  assert.equal(osRes.statusCode, 201);
  const os = osRes.json();

  const tplRes = await app.inject({
    method: 'POST',
    url: '/api/v1/checklists/templates',
    headers: headersA,
    payload: {
      category: 'notebook',
      title: 'Saída Obrigatória Notebook',
      blockClosingIfIncomplete: true,
      items: [
        { key: 'charge_ok', label: 'Teste de carga validado', required: true },
        { key: 'polish', label: 'Limpeza estética', required: false },
      ],
    },
  });
  assert.equal(tplRes.statusCode, 201);
  const tpl = tplRes.json();

  // Apply template with unchecked required item
  const attachRes = await app.inject({
    method: 'POST',
    url: `/api/v1/service-orders/${os.id}/checklist`,
    headers: headersA,
    payload: { templateId: tpl.id, responses: {} },
  });
  assert.equal(attachRes.statusCode, 201);
  assert.equal(attachRes.json().completedRequired, false);

  // 3. Attempting to mark OS as DELIVERED must be BLOCKED (400)
  const blockedClose = await app.inject({
    method: 'PATCH',
    url: `/api/v1/service-orders/${os.id}/status`,
    headers: headersA,
    payload: { status: 'DELIVERED', notifyWhatsapp: false },
  });
  assert.equal(blockedClose.statusCode, 400);

  // Complete required item -> DELIVERED succeeds!
  const completeChecklist = await app.inject({
    method: 'POST',
    url: `/api/v1/service-orders/${os.id}/checklist`,
    headers: headersA,
    payload: {
      responses: { charge_ok: { checked: true } },
    },
  });
  assert.equal(completeChecklist.statusCode, 201);
  assert.equal(completeChecklist.json().completedRequired, true);

  const allowClose = await app.inject({
    method: 'PATCH',
    url: `/api/v1/service-orders/${os.id}/status`,
    headers: headersA,
    payload: { status: 'DELIVERED', notifyWhatsapp: false },
  });
  assert.equal(allowClose.statusCode, 200);
  assert.equal(allowClose.json().status, 'DELIVERED');

  // 4. Automation Rule Engine: Low stock + Post-service preventive + Idempotency
  const prodRes = await app.inject({
    method: 'POST',
    url: '/api/v1/inventory/products',
    headers: headersA,
    payload: {
      sku: `CRIT-${suffix}`,
      name: 'Pasta Termica Prata',
      category: 'consumivel',
      costCents: 1500,
      priceCents: 4500,
      stockQty: 1,
      minStockQty: 4,
    },
  });
  assert.equal(prodRes.statusCode, 201);

  const ruleRes = await app.inject({
    method: 'POST',
    url: '/api/v1/automations/rules',
    headers: headersA,
    payload: {
      name: 'Alerta Estoque Critico Teste',
      triggerEvent: 'stock.low_alert',
      channel: 'internal_alert',
      delayHours: 0,
      templateText: 'Abrir cotacao B2B vs Marketplace imediatamente.',
    },
  });
  assert.equal(ruleRes.statusCode, 201);

  const run1 = await app.inject({
    method: 'POST',
    url: '/api/v1/automations/run-now',
    headers: headersA,
  });
  assert.equal(run1.statusCode, 201);
  assert.equal(run1.json().newExecutionsCount, 1);

  // Running a second time must be idempotent (0 duplicate executions!)
  const run2 = await app.inject({
    method: 'POST',
    url: '/api/v1/automations/run-now',
    headers: headersA,
  });
  assert.equal(run2.statusCode, 201);
  assert.equal(run2.json().newExecutionsCount, 0);
});
