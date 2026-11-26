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

test('Phase 5 E2E: Knowledge RAG (pgvector+FTS+RRF), Cross-Tenant Isolation, Daily Briefing & Copilot', async (t) => {
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

  // 1. Register Tenant A with AI, OS & Inventory modules
  const regARes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      ownerName: 'Gestor IA',
      organizationName: `Org IA ${suffix}`,
      email: `p5-a-${suffix}@test.local`,
      password: 'Password@123',
      enabledModules: [
        'core',
        'mod-service-orders',
        'mod-inventory-pos',
        'mod-ai-agents',
      ],
    },
  });
  assert.equal(regARes.statusCode, 201);
  const tenantA = regARes.json();
  createdOrgIds.push(tenantA.user.organizationId);
  const authA = { authorization: `Bearer ${tenantA.accessToken}` };

  // 2. Ingest internal policy document into RAG
  const ingestRes = await app.inject({
    method: 'POST',
    url: '/api/v1/ai/knowledge/documents',
    headers: authA,
    payload: {
      title: 'Política Especial de Garantia BGA',
      sourceType: 'policy',
      content:
        'Reparos avançados em placa-mãe e reballing BGA possuem garantia estendida de 180 dias para clientes corporativos com contrato ativo.',
    },
  });
  assert.equal(ingestRes.statusCode, 201);
  assert.equal(ingestRes.json().chunksCount, 1);

  // 3. Hybrid Search retrieves ingested document with citation
  const searchRes = await app.inject({
    method: 'POST',
    url: '/api/v1/ai/knowledge/search',
    headers: authA,
    payload: { query: 'garantia reballing BGA placa-mãe', limit: 3 },
  });
  assert.equal(searchRes.statusCode, 201);
  assert.equal(searchRes.json().length, 1);
  assert.equal(
    searchRes.json()[0].documentTitle,
    'Política Especial de Garantia BGA',
  );

  // 4. Cross-tenant RAG isolation: Tenant B must see 0 hits for Tenant A's policy
  const regBRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      ownerName: 'Gestor B',
      organizationName: `Org B ${suffix}`,
      email: `p5-b-${suffix}@test.local`,
      password: 'Password@123',
      enabledModules: ['core', 'mod-ai-agents'],
    },
  });
  const tenantB = regBRes.json();
  createdOrgIds.push(tenantB.user.organizationId);

  const searchB = await app.inject({
    method: 'POST',
    url: '/api/v1/ai/knowledge/search',
    headers: { authorization: `Bearer ${tenantB.accessToken}` },
    payload: { query: 'reballing BGA 180 dias', limit: 3 },
  });
  assert.equal(searchB.statusCode, 201);
  assert.equal(searchB.json().length, 0);

  // 5. Create low-stock item + OS and verify Daily Briefing & Operational Copilot
  await app.inject({
    method: 'POST',
    url: '/api/v1/inventory/products',
    headers: authA,
    payload: {
      sku: `LOW-${suffix}`,
      name: 'Bateria Dell XPS',
      priceCents: 39000,
      stockQty: 1,
      minStockQty: 3,
    },
  });

  const briefingRes = await app.inject({
    method: 'GET',
    url: '/api/v1/ai/briefing',
    headers: authA,
  });
  assert.equal(briefingRes.statusCode, 200);
  assert.equal(briefingRes.json().lowStockCount, 1);
  assert.ok(briefingRes.json().highlights.length === 4);

  const copilotStock = await app.inject({
    method: 'POST',
    url: '/api/v1/ai/copilot/ask',
    headers: authA,
    payload: { question: 'Quais peças estão com estoque baixo?' },
  });
  assert.equal(copilotStock.statusCode, 201);
  assert.ok(copilotStock.json().answer.includes('Bateria Dell XPS'));

  const copilotRag = await app.inject({
    method: 'POST',
    url: '/api/v1/ai/copilot/ask',
    headers: authA,
    payload: { question: 'Qual a garantia de reballing BGA?' },
  });
  assert.equal(copilotRag.statusCode, 201);
  assert.ok(
    copilotRag
      .json()
      .sources.some(
        (s: { documentTitle: string }) =>
          s.documentTitle === 'Política Especial de Garantia BGA',
      ),
  );

  // 6. AI Telemetry records runs
  const telemetryRes = await app.inject({
    method: 'GET',
    url: '/api/v1/ai/telemetry',
    headers: authA,
  });
  assert.equal(telemetryRes.statusCode, 200);
  assert.ok(telemetryRes.json().length >= 3);
});
