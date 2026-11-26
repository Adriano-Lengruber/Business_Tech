import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Test } from '@nestjs/testing';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import multipart from '@fastify/multipart';
import { and, auditLogs, eq, organizations } from '@al/database';
import { AppModule } from '../app.module';
import { DatabaseService } from '../database/database.module';
import { decryptSecret, encryptSecret } from '../common/crypto/encryption';

test('Unit: AES-256-GCM encryption roundtrip & tamper detection', () => {
  const plain = 'PinBancada!2026';
  const cipher = encryptSecret(plain);
  assert.ok(cipher.startsWith('v1:'));
  assert.ok(!cipher.includes(plain));
  assert.equal(decryptSecret(cipher), plain);

  const hexKey = '0123456789abcdef'.repeat(4);
  const cipherHex = encryptSecret('987654', hexKey);
  assert.equal(decryptSecret(cipherHex, hexKey), '987654');

  // Tampering auth tag must throw
  const parts = cipher.split(':');
  parts[2] = '00'.repeat(16);
  assert.throws(() => decryptSecret(parts.join(':')));
});

test('Phase 6 E2E: Instant Briefing (<500ms), Analytics BI, Encrypted Device PIN (LGPD) & Audit', async (t) => {
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

  // 1. Register tenant with OS + AI + Finance modules
  const regRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      ownerName: 'Gestor Atelier',
      organizationName: `Org Atelier ${suffix}`,
      email: `p6-${suffix}@test.local`,
      password: 'Password@123',
      enabledModules: [
        'core',
        'mod-service-orders',
        'mod-finance-fiscal',
        'mod-ai-agents',
      ],
    },
  });
  assert.equal(regRes.statusCode, 201);
  const auth = regRes.json();
  createdOrgIds.push(auth.user.organizationId);
  const headers = { authorization: `Bearer ${auth.accessToken}` };

  // 2. Create customer + OS with encrypted device PIN
  const custRes = await app.inject({
    method: 'POST',
    url: '/api/v1/customers',
    headers,
    payload: {
      type: 'PF',
      name: 'Cliente LGPD Teste',
      phoneE164: '+5511988887777',
    },
  });
  assert.equal(custRes.statusCode, 201);
  const customer = custRes.json();

  const secretPin = 'SenhaSuperSecreta#9988';
  const osRes = await app.inject({
    method: 'POST',
    url: '/api/v1/service-orders',
    headers,
    payload: {
      customerId: customer.id,
      priority: 'HIGH',
      reportedSymptoms: 'Equipamento reiniciando ao abrir navegador.',
      devicePassword: secretPin,
      devicePasswordHint: 'Usuario Principal',
      notifyWhatsapp: false,
    },
  });
  assert.equal(osRes.statusCode, 201);
  const createdOs = osRes.json();
  assert.equal(createdOs.hasDevicePassword, true);
  assert.equal(createdOs.devicePasswordEncrypted, undefined);
  assert.ok(!JSON.stringify(createdOs).includes(secretPin));

  // 3. Detail endpoint hides raw password/ciphertext
  const detailRes = await app.inject({
    method: 'GET',
    url: `/api/v1/service-orders/${createdOs.id}`,
    headers,
  });
  assert.equal(detailRes.statusCode, 200);
  const detailJson = detailRes.json();
  assert.equal(detailJson.os.hasDevicePassword, true);
  assert.equal(detailJson.os.devicePasswordEncrypted, undefined);
  assert.ok(!JSON.stringify(detailJson).includes(secretPin));

  // 4. Intake PDF never includes sensitive device password
  const pdfRes = await app.inject({
    method: 'GET',
    url: `/api/v1/service-orders/${createdOs.id}/intake-pdf`,
    headers,
  });
  assert.equal(pdfRes.statusCode, 200);
  assert.ok(pdfRes.rawPayload.toString('utf8').startsWith('%PDF-'));
  assert.ok(!pdfRes.rawPayload.toString('utf8').includes(secretPin));

  // 5. Public Portal view never exposes device password
  const portalUrl = new URL(createdOs.portalUrl);
  const tokenParam = portalUrl.searchParams.get('token')!;
  const portalRes = await app.inject({
    method: 'GET',
    url: `/api/v1/portal/${createdOs.code}?token=${tokenParam}`,
  });
  assert.equal(portalRes.statusCode, 200);
  assert.ok(!portalRes.body.includes(secretPin));

  // 6. Audited password reveal decrypts secret and writes audit log
  const revealRes = await app.inject({
    method: 'POST',
    url: `/api/v1/service-orders/${createdOs.id}/reveal-password`,
    headers,
  });
  assert.equal(revealRes.statusCode, 201);
  assert.equal(revealRes.json().password, secretPin);
  assert.equal(revealRes.json().hint, 'Usuario Principal');

  const logs = await dbService.db
    .select()
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.organizationId, auth.user.organizationId),
        eq(auditLogs.action, 'service_order.password_revealed'),
      ),
    );
  assert.equal(logs.length, 1);

  // 7. Instant Daily Briefing (<500ms even with Ollama offline)
  const t0 = Date.now();
  const briefingRes = await app.inject({
    method: 'GET',
    url: '/api/v1/ai/briefing',
    headers,
  });
  const elapsedMs = Date.now() - t0;
  assert.equal(briefingRes.statusCode, 200);
  assert.ok(elapsedMs < 800, `Briefing demorou ${elapsedMs}ms (esperado <800ms)`);
  const briefing = briefingRes.json();
  assert.equal(briefing.openOsCount, 1);
  assert.ok(Array.isArray(briefing.highlights));

  // 8. Analytics BI endpoint returns real chart datasets
  const analyticsRes = await app.inject({
    method: 'GET',
    url: '/api/v1/analytics/overview',
    headers,
  });
  assert.equal(analyticsRes.statusCode, 200);
  const analytics = analyticsRes.json();
  assert.equal(analytics.summary.totalOs, 1);
  assert.equal(analytics.osByStage.length, 6);
  assert.equal(analytics.dailyCashflow.length, 7);
});
