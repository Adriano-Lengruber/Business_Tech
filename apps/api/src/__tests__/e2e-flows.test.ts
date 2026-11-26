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
import { appEnv } from '../config/env';
import { DatabaseService } from '../database/database.module';

test('API E2E: Entitlements, Intake->PDF, Diagnostic, Quote, Portal Approval, PIX, Asaas Webhook & Cross-Tenant Isolation', async (t) => {
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

  // 1. Unauthenticated request blocked
  const unauthRes = await app.inject({
    method: 'GET',
    url: '/api/v1/customers',
  });
  assert.equal(unauthRes.statusCode, 401);

  // 2. Register Tenant A WITHOUT mod-finance-fiscal
  const regARes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      ownerName: 'Dono A',
      organizationName: `Assistência E2E ${suffix}`,
      email: `e2e-a-${suffix}@test.local`,
      password: 'Password@123',
      enabledModules: ['core', 'mod-service-orders', 'mod-ai-agents'],
    },
  });
  assert.equal(regARes.statusCode, 201);
  const tenantA = regARes.json();
  createdOrgIds.push(tenantA.user.organizationId);

  const authA = { authorization: `Bearer ${tenantA.accessToken}` };

  // 3. Disabled module blocked by ModuleEntitlementGuard
  const finBlocked = await app.inject({
    method: 'GET',
    url: '/api/v1/finance/summary',
    headers: authA,
  });
  assert.equal(finBlocked.statusCode, 403);

  // Core module cannot be disabled
  const coreDisable = await app.inject({
    method: 'PATCH',
    url: '/api/v1/modules/core',
    headers: authA,
    payload: { enabled: false },
  });
  assert.equal(coreDisable.statusCode, 400);

  // Enable mod-finance-fiscal dynamically
  const finEnable = await app.inject({
    method: 'PATCH',
    url: '/api/v1/modules/mod-finance-fiscal',
    headers: authA,
    payload: { enabled: true },
  });
  assert.equal(finEnable.statusCode, 200);

  const finAllowed = await app.inject({
    method: 'GET',
    url: '/api/v1/finance/summary',
    headers: authA,
  });
  assert.equal(finAllowed.statusCode, 200);

  // 4. Counter Intake: Customer -> Asset (QR) -> Service Order -> PDF
  const custRes = await app.inject({
    method: 'POST',
    url: '/api/v1/customers',
    headers: authA,
    payload: {
      type: 'PF',
      name: 'Maria Clara Testes',
      phoneE164: '11988887777',
    },
  });
  assert.equal(custRes.statusCode, 201);
  const customer = custRes.json();

  const assetRes = await app.inject({
    method: 'POST',
    url: '/api/v1/assets',
    headers: authA,
    payload: {
      customerId: customer.id,
      category: 'notebook',
      brand: 'Lenovo',
      model: 'ThinkPad T14',
      serialNumber: 'SN-E2E-123',
    },
  });
  assert.equal(assetRes.statusCode, 201);
  const asset = assetRes.json();
  assert.ok(asset.qrToken.startsWith('qr-al-'));

  const osRes = await app.inject({
    method: 'POST',
    url: '/api/v1/service-orders',
    headers: authA,
    payload: {
      customerId: customer.id,
      assetId: asset.id,
      priority: 'HIGH',
      reportedSymptoms: 'Não liga após queda de energia.',
      preliminaryDiagnosis: 'Possível curto no circuito de entrada.',
      notifyWhatsapp: false,
    },
  });
  assert.equal(osRes.statusCode, 201);
  const os = osRes.json();
  assert.equal(os.code, 'OS-2026-0001');
  assert.ok(os.portalToken);

  const pdfRes = await app.inject({
    method: 'GET',
    url: `/api/v1/service-orders/${os.id}/intake-pdf`,
    headers: authA,
  });
  assert.equal(pdfRes.statusCode, 200);
  assert.equal(pdfRes.headers['content-type'], 'application/pdf');
  assert.ok(pdfRes.rawPayload.subarray(0, 4).toString() === '%PDF');

  // 5. Global Search (⌘K)
  const searchRes = await app.inject({
    method: 'GET',
    url: '/api/v1/search?q=ThinkPad',
    headers: authA,
  });
  assert.equal(searchRes.statusCode, 200);
  assert.equal(searchRes.json().assets.length, 1);

  // 6. Diagnostic + AI Assist + Quote Creation
  const aiAssistRes = await app.inject({
    method: 'POST',
    url: `/api/v1/service-orders/${os.id}/diagnostics/ai-assist`,
    headers: authA,
    payload: { observedFacts: 'Sem consumo na fonte de bancada; capacitor em curto.' },
  });
  assert.equal(aiAssistRes.statusCode, 201);
  assert.ok(Array.isArray(aiAssistRes.json().hypotheses));

  const diagRes = await app.inject({
    method: 'POST',
    url: `/api/v1/service-orders/${os.id}/diagnostics`,
    headers: authA,
    payload: {
      category: 'nao-liga',
      observedFacts: 'Curto na linha primária de 19V.',
      finalDiagnosis: 'Capacitor cerâmico em curto na entrada.',
      clientExplanation: 'Identificamos um componente de proteção em curto que impede o notebook de ligar.',
      moveToAwaitingQuote: true,
    },
  });
  assert.equal(diagRes.statusCode, 201);

  const quoteRes = await app.inject({
    method: 'POST',
    url: `/api/v1/service-orders/${os.id}/quotes`,
    headers: authA,
    payload: {
      tier: 'recommended',
      warrantyDays: 90,
      sendImmediately: true,
      items: [
        {
          itemType: 'labor',
          description: 'Reparo em placa-mãe',
          quantity: 1,
          unitCostCents: 0,
          unitPriceCents: 25000,
        },
        {
          itemType: 'part',
          description: 'Componente SMD linha 19V',
          quantity: 1,
          unitCostCents: 1500,
          unitPriceCents: 5000,
        },
      ],
    },
  });
  assert.equal(quoteRes.statusCode, 201);
  const quote = quoteRes.json();
  assert.equal(quote.totalCents, 30000);

  // 7. Customer Portal: invalid token rejected, valid token approves and creates PIX receivable
  const portalDenied = await app.inject({
    method: 'GET',
    url: `/api/v1/portal/${os.code}?token=wrong-token`,
  });
  assert.equal(portalDenied.statusCode, 401);

  const portalOk = await app.inject({
    method: 'GET',
    url: `/api/v1/portal/${os.code}?token=${os.portalToken}`,
  });
  assert.equal(portalOk.statusCode, 200);
  assert.equal(portalOk.json().quotes.length, 1);

  const decideRes = await app.inject({
    method: 'POST',
    url: `/api/v1/portal/${os.code}/quotes/${quote.id}/decide?token=${os.portalToken}`,
    payload: { decision: 'APPROVED', paymentMethod: 'pix' },
  });
  assert.equal(decideRes.statusCode, 201);
  const decided = decideRes.json();
  assert.equal(decided.quote.status, 'APPROVED');
  assert.ok(decided.quote.acceptanceHash);
  assert.equal(decided.transaction.amountCents, 30000);
  assert.ok(decided.transaction.pixCopyPaste);

  // Re-deciding same quote is rejected
  const doubleDecide = await app.inject({
    method: 'POST',
    url: `/api/v1/portal/${os.code}/quotes/${quote.id}/decide?token=${os.portalToken}`,
    payload: { decision: 'REJECTED' },
  });
  assert.equal(doubleDecide.statusCode, 400);

  // 8. Asaas Webhook confirms payment idempotently
  const [orgRow] = await dbService.db
    .select({ slug: organizations.slug })
    .from(organizations)
    .where(eq(organizations.id, tenantA.user.organizationId))
    .limit(1);

  const webhook1 = await app.inject({
    method: 'POST',
    url: `/api/v1/webhooks/asaas/${orgRow!.slug}`,
    headers: { 'asaas-access-token': appEnv.ASAAS_WEBHOOK_TOKEN },
    payload: {
      event: 'PAYMENT_CONFIRMED',
      payment: { id: decided.transaction.gatewayChargeId },
    },
  });
  assert.equal(webhook1.statusCode, 201);
  assert.equal(webhook1.json().confirmed, true);

  const webhook2 = await app.inject({
    method: 'POST',
    url: `/api/v1/webhooks/asaas/${orgRow!.slug}`,
    headers: { 'asaas-access-token': appEnv.ASAAS_WEBHOOK_TOKEN },
    payload: {
      event: 'PAYMENT_CONFIRMED',
      payment: { id: decided.transaction.gatewayChargeId },
    },
  });
  assert.equal(webhook2.statusCode, 201);
  assert.equal(webhook2.json().idempotent, true);

  const summaryAfter = await app.inject({
    method: 'GET',
    url: '/api/v1/finance/summary',
    headers: authA,
  });
  assert.equal(summaryAfter.json().confirmedReceivableCents, 30000);

  // 9. Cross-tenant isolation via API
  const regBRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      ownerName: 'Dono B',
      organizationName: `Assistência B ${suffix}`,
      email: `e2e-b-${suffix}@test.local`,
      password: 'Password@123',
      enabledModules: ['core', 'mod-service-orders'],
    },
  });
  const tenantB = regBRes.json();
  createdOrgIds.push(tenantB.user.organizationId);

  const crossTenantOs = await app.inject({
    method: 'GET',
    url: `/api/v1/service-orders/${os.id}`,
    headers: { authorization: `Bearer ${tenantB.accessToken}` },
  });
  assert.equal(crossTenantOs.statusCode, 404);
});
