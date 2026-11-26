import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import http from 'node:http';
import { Test } from '@nestjs/testing';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import multipart from '@fastify/multipart';
import { eq, organizations, users } from '@al/database';
import { AppModule } from '../app.module';
import { DatabaseService } from '../database/database.module';

test('Phase 11 E2E: Audit Trail RBAC, Team Member Creation, API Keys & Signed HMAC Webhook Delivery', async (t) => {
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
  const createdUserEmails: string[] = [];

  // Ephemeral local HTTP receiver for testing signed HMAC webhook delivery
  let receivedBody = '';
  let receivedSignature = '';
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      receivedBody = Buffer.concat(chunks).toString('utf8');
      receivedSignature = String(req.headers['x-al-signature'] ?? '');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  const receiverUrl = `http://127.0.0.1:${address.port}/hook`;

  t.after(async () => {
    server.close();
    for (const email of createdUserEmails) {
      await dbService.db.delete(users).where(eq(users.email, email));
    }
    for (const orgId of createdOrgIds) {
      await dbService.db
        .delete(organizations)
        .where(eq(organizations.id, orgId));
    }
    await app.close();
  });

  // 1. Register Org Owner
  const ownerEmail = `p11-owner-${suffix}@test.local`;
  createdUserEmails.push(ownerEmail);
  const regRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      ownerName: 'Dono Segurança',
      organizationName: `Org Sec ${suffix}`,
      email: ownerEmail,
      password: 'Password@123',
      enabledModules: ['core', 'mod-service-orders'],
    },
  });
  assert.equal(regRes.statusCode, 201);
  const owner = regRes.json();
  createdOrgIds.push(owner.user.organizationId);
  const ownerHeaders = { authorization: `Bearer ${owner.accessToken}` };

  // 2. Owner adds Technician member via RBAC endpoint
  const techEmail = `p11-tech-${suffix}@test.local`;
  createdUserEmails.push(techEmail);
  const addTechRes = await app.inject({
    method: 'POST',
    url: '/api/v1/security/team',
    headers: ownerHeaders,
    payload: {
      name: 'Tecnico Bancada',
      email: techEmail,
      password: 'TechPass@123',
      role: 'technician',
    },
  });
  assert.equal(addTechRes.statusCode, 201);
  assert.equal(addTechRes.json().role, 'technician');

  // Technician can login but is BLOCKED (403) from audit logs and integrations
  const techLogin = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email: techEmail, password: 'TechPass@123' },
  });
  assert.equal(techLogin.statusCode, 201);
  const techHeaders = {
    authorization: `Bearer ${techLogin.json().accessToken}`,
  };

  const blockedAudit = await app.inject({
    method: 'GET',
    url: '/api/v1/security/audit-logs',
    headers: techHeaders,
  });
  assert.equal(blockedAudit.statusCode, 403);

  const blockedKeys = await app.inject({
    method: 'GET',
    url: '/api/v1/integrations',
    headers: techHeaders,
  });
  assert.equal(blockedKeys.statusCode, 403);

  // 3. Owner creates API Key (receives plaintext once; list hides hash) & revokes it
  const keyRes = await app.inject({
    method: 'POST',
    url: '/api/v1/integrations/api-keys',
    headers: ownerHeaders,
    payload: { name: 'Integracao n8n' },
  });
  assert.equal(keyRes.statusCode, 201);
  const createdKey = keyRes.json();
  assert.ok(createdKey.plainKey.startsWith('al_live_'));
  assert.equal(createdKey.keyHash, undefined);

  const revokeRes = await app.inject({
    method: 'DELETE',
    url: `/api/v1/integrations/api-keys/${createdKey.id}`,
    headers: ownerHeaders,
  });
  assert.equal(revokeRes.statusCode, 200);
  assert.equal(revokeRes.json().isActive, false);

  // 4. Create Outbound Webhook & Test real HTTP delivery + HMAC-SHA256 verification
  const hookRes = await app.inject({
    method: 'POST',
    url: '/api/v1/integrations/webhooks',
    headers: ownerHeaders,
    payload: {
      name: 'Local E2E Receiver',
      targetUrl: receiverUrl,
      events: ['service_order.created'],
    },
  });
  assert.equal(hookRes.statusCode, 201);
  const hook = hookRes.json();
  assert.ok(hook.signingSecret.startsWith('whsec_'));

  const pingRes = await app.inject({
    method: 'POST',
    url: `/api/v1/integrations/webhooks/${hook.id}/test`,
    headers: ownerHeaders,
  });
  assert.equal(pingRes.statusCode, 201);
  assert.equal(pingRes.json().delivered, true);
  assert.equal(pingRes.json().statusCode, 200);

  const expectedSig = `sha256=${createHmac('sha256', hook.signingSecret)
    .update(receivedBody)
    .digest('hex')}`;
  assert.equal(receivedSignature, expectedSig);
  assert.ok(receivedBody.includes(owner.user.organizationId));

  // 5. Audit logs contain all security events
  const auditRes = await app.inject({
    method: 'GET',
    url: '/api/v1/security/audit-logs',
    headers: ownerHeaders,
  });
  assert.equal(auditRes.statusCode, 200);
  const actions = (auditRes.json() as Array<{ action: string }>).map(
    (l) => l.action,
  );
  assert.ok(actions.includes('team.member_added'));
  assert.ok(actions.includes('integration.api_key_created'));
  assert.ok(actions.includes('integration.webhook_tested'));
  // Ensure deterministic hash check unused warning doesn't happen
  assert.ok(createHash('sha256').update('ok').digest('hex').length === 64);
});
