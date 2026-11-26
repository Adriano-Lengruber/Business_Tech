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

test('Phase 7 E2E: Hardware Before/After Diff, Comparative PDF, Warranties/RMA & B2B Contracts SLA', async (t) => {
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

  // 1. Register Tenant A with OS, Finance & Contracts modules
  const regARes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      ownerName: 'Gestor B2B',
      organizationName: `Org B2B ${suffix}`,
      email: `p7-a-${suffix}@test.local`,
      password: 'Password@123',
      enabledModules: [
        'core',
        'mod-service-orders',
        'mod-finance-fiscal',
        'mod-contracts-sla',
      ],
    },
  });
  assert.equal(regARes.statusCode, 201);
  const tenantA = regARes.json();
  createdOrgIds.push(tenantA.user.organizationId);
  const headersA = { authorization: `Bearer ${tenantA.accessToken}` };

  // Register Tenant B WITHOUT mod-contracts-sla
  const regBRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      ownerName: 'Gestor Isolado',
      organizationName: `Org Isolado ${suffix}`,
      email: `p7-b-${suffix}@test.local`,
      password: 'Password@123',
      enabledModules: ['core', 'mod-service-orders'],
    },
  });
  assert.equal(regBRes.statusCode, 201);
  const tenantB = regBRes.json();
  createdOrgIds.push(tenantB.user.organizationId);
  const headersB = { authorization: `Bearer ${tenantB.accessToken}` };

  // 2. Module Entitlement Guard blocks Tenant B from /contracts
  const blockedRes = await app.inject({
    method: 'GET',
    url: '/api/v1/contracts',
    headers: headersB,
  });
  assert.equal(blockedRes.statusCode, 403);

  // 3. Create customer & OS on Tenant A
  const custRes = await app.inject({
    method: 'POST',
    url: '/api/v1/customers',
    headers: headersA,
    payload: {
      type: 'PJ',
      name: 'Clinica Modelo LTDA',
      phoneE164: '+5511977776666',
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
      reportedSymptoms: 'Superaquecimento e lentidao extrema.',
      notifyWhatsapp: false,
    },
  });
  assert.equal(osRes.statusCode, 201);
  const os = osRes.json();

  // 4. Record BEFORE and AFTER hardware snapshots and check diff
  const beforeRes = await app.inject({
    method: 'POST',
    url: `/api/v1/service-orders/${os.id}/hardware-snapshots`,
    headers: headersA,
    payload: {
      stage: 'BEFORE',
      source: 'windows_collector',
      cpuModel: 'Intel Core i5-1235U',
      ramGb: 8,
      storageSummary: 'NVMe 256GB',
      smartHealthPct: 68,
      cpuTempCelsius: 99,
    },
  });
  assert.equal(beforeRes.statusCode, 201);

  const afterRes = await app.inject({
    method: 'POST',
    url: `/api/v1/service-orders/${os.id}/hardware-snapshots`,
    headers: headersA,
    payload: {
      stage: 'AFTER',
      source: 'windows_collector',
      cpuModel: 'Intel Core i5-1235U',
      ramGb: 16,
      storageSummary: 'NVMe 1TB Kingston',
      smartHealthPct: 100,
      cpuTempCelsius: 63,
    },
  });
  assert.equal(afterRes.statusCode, 201);

  const diffRes = await app.inject({
    method: 'GET',
    url: `/api/v1/service-orders/${os.id}/hardware-snapshots`,
    headers: headersA,
  });
  assert.equal(diffRes.statusCode, 200);
  const diffJson = diffRes.json();
  assert.equal(diffJson.diff.ramDeltaGb, 8);
  assert.equal(diffJson.diff.tempDeltaCelsius, -36);
  assert.equal(diffJson.diff.smartDeltaPct, 32);
  assert.equal(diffJson.diff.storageChanged, true);

  // Cross-tenant isolation on snapshots
  const crossDiffRes = await app.inject({
    method: 'GET',
    url: `/api/v1/service-orders/${os.id}/hardware-snapshots`,
    headers: headersB,
  });
  assert.equal(crossDiffRes.statusCode, 200);
  assert.equal(crossDiffRes.json().snapshots.length, 0);

  // 5. Generate Comparative Diagnostic Report PDF
  const pdfRes = await app.inject({
    method: 'GET',
    url: `/api/v1/service-orders/${os.id}/diagnostic-report-pdf`,
    headers: headersA,
  });
  assert.equal(pdfRes.statusCode, 200);
  assert.ok(pdfRes.rawPayload.toString('utf8').startsWith('%PDF-'));

  // 6. Create Warranty & claim it (triggers OS WARRANTY state)
  const warRes = await app.inject({
    method: 'POST',
    url: `/api/v1/service-orders/${os.id}/warranties`,
    headers: headersA,
    payload: {
      kind: 'service',
      warrantyDays: 90,
      partDescription: 'Troca SSD + Limpeza Termica',
    },
  });
  assert.equal(warRes.statusCode, 201);
  const warranty = warRes.json();

  const claimRes = await app.inject({
    method: 'PATCH',
    url: `/api/v1/warranties/${warranty.id}/status`,
    headers: headersA,
    payload: {
      status: 'CLAIMED',
      resolutionNotes: 'Cliente retornou relatando ruído no cooler.',
    },
  });
  assert.equal(claimRes.statusCode, 200);
  assert.equal(claimRes.json().status, 'CLAIMED');

  const osAfterClaim = await app.inject({
    method: 'GET',
    url: `/api/v1/service-orders/${os.id}`,
    headers: headersA,
  });
  assert.equal(osAfterClaim.json().os.status, 'WARRANTY');

  // 7. Create B2B Contract, log hours, complete preventive & bill monthly PIX
  const ctrRes = await app.inject({
    method: 'POST',
    url: '/api/v1/contracts',
    headers: headersA,
    payload: {
      customerId: customer.id,
      title: 'Contrato Suporte Mensal 10 Estacoes',
      planTier: 'preventive',
      monthlyPriceCents: 149000,
      includedHours: 10,
      slaResponseHours: 4,
      coveredAssetsCount: 10,
      preventiveFrequencyDays: 60,
    },
  });
  assert.equal(ctrRes.statusCode, 201);
  const contract = ctrRes.json();

  const usageRes = await app.inject({
    method: 'POST',
    url: `/api/v1/contracts/${contract.id}/log-usage`,
    headers: headersA,
    payload: { hoursUsed: 2, notes: 'Manutenção rede' },
  });
  assert.equal(usageRes.statusCode, 201);
  assert.equal(usageRes.json().usedHours, 2);

  const prevRes = await app.inject({
    method: 'POST',
    url: `/api/v1/contracts/${contract.id}/preventive-done`,
    headers: headersA,
  });
  assert.equal(prevRes.statusCode, 201);

  const billRes = await app.inject({
    method: 'POST',
    url: `/api/v1/contracts/${contract.id}/bill-month`,
    headers: headersA,
  });
  assert.equal(billRes.statusCode, 201);
  assert.equal(billRes.json().amountCents, 149000);

  const listCtrRes = await app.inject({
    method: 'GET',
    url: '/api/v1/contracts',
    headers: headersA,
  });
  assert.equal(listCtrRes.statusCode, 200);
  assert.equal(listCtrRes.json().summary.mrrCents, 149000);
});
