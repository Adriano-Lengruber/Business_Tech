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

test('Phase 4 E2E: 3D Print + Filament Deduction, Projects Kanban/Retainer & Social AI + Lead Capture', async (t) => {
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

  // 1. Register tenant without specialized modules
  const regRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      ownerName: 'Maker Dev',
      organizationName: `Studio P4 ${suffix}`,
      email: `p4-${suffix}@test.local`,
      password: 'Password@123',
      enabledModules: ['core', 'mod-ai-agents'],
    },
  });
  assert.equal(regRes.statusCode, 201);
  const tenant = regRes.json();
  createdOrgIds.push(tenant.user.organizationId);
  const auth = { authorization: `Bearer ${tenant.accessToken}` };

  // 2. Specialized modules blocked when disabled (403)
  assert.equal(
    (await app.inject({ method: 'GET', url: '/api/v1/print3d/jobs', headers: auth })).statusCode,
    403,
  );
  assert.equal(
    (await app.inject({ method: 'GET', url: '/api/v1/projects', headers: auth })).statusCode,
    403,
  );
  assert.equal(
    (await app.inject({ method: 'GET', url: '/api/v1/social/posts', headers: auth })).statusCode,
    403,
  );

  // Enable all 3 specialized modules
  for (const mod of ['mod-3d-print', 'mod-projects-dev', 'mod-social-growth']) {
    await app.inject({
      method: 'PATCH',
      url: `/api/v1/modules/${mod}`,
      headers: auth,
      payload: { enabled: true },
    });
  }

  // 3. 3D Print: Create filament (500g), create job (150g), transition to PRINTING -> deducts to 350g
  const filRes = await app.inject({
    method: 'POST',
    url: '/api/v1/print3d/filaments',
    headers: auth,
    payload: {
      name: 'PLA Preto E2E',
      materialType: 'PLA',
      color: 'Preto',
      costPerKgCents: 12000,
      stockGrams: 500,
    },
  });
  assert.equal(filRes.statusCode, 201);
  const filament = filRes.json();

  const jobRes = await app.inject({
    method: 'POST',
    url: '/api/v1/print3d/jobs',
    headers: auth,
    payload: {
      filamentId: filament.id,
      modelName: 'Case Raspberry Pi',
      weightGrams: 150,
      printTimeMinutes: 120,
      profitMarginPercent: 100,
    },
  });
  assert.equal(jobRes.statusCode, 201);
  const job = jobRes.json();
  assert.ok(job.salePriceCents > job.totalCostCents);

  const printStart = await app.inject({
    method: 'PATCH',
    url: `/api/v1/print3d/jobs/${job.id}/status`,
    headers: auth,
    payload: { status: 'PRINTING' },
  });
  assert.equal(printStart.statusCode, 200);
  assert.equal(printStart.json().status, 'PRINTING');

  const filsAfter = await app.inject({
    method: 'GET',
    url: '/api/v1/print3d/filaments',
    headers: auth,
  });
  assert.equal(filsAfter.json()[0].stockGrams, 350);

  // 4. Projects: Create 10h retainer project, add Kanban task, move to DONE, log 8h (80% -> nearLimit)
  const prjRes = await app.inject({
    method: 'POST',
    url: '/api/v1/projects',
    headers: auth,
    payload: {
      title: 'Sistema ERP Customizado',
      projectType: 'software_dev',
      retainerHoursMonthly: 10,
    },
  });
  assert.equal(prjRes.statusCode, 201);
  const project = prjRes.json();

  const taskRes = await app.inject({
    method: 'POST',
    url: `/api/v1/projects/${project.id}/tasks`,
    headers: auth,
    payload: { title: 'Implementar API REST' },
  });
  const task = taskRes.json();

  await app.inject({
    method: 'PATCH',
    url: `/api/v1/projects/tasks/${task.id}/status`,
    headers: auth,
    payload: { status: 'DONE' },
  });

  await app.inject({
    method: 'POST',
    url: `/api/v1/projects/${project.id}/time-entries`,
    headers: auth,
    payload: { minutes: 480, description: 'Sprint 1 backend' },
  });

  const prjList = await app.inject({
    method: 'GET',
    url: '/api/v1/projects',
    headers: auth,
  });
  assert.equal(prjList.json()[0].doneTasksCount, 1);
  assert.equal(prjList.json()[0].retainer.utilizationPercent, 80);
  assert.equal(prjList.json()[0].retainer.isNearLimit, true);

  // 5. Social Growth: AI Generate draft -> Approve & Publish -> Convert Comment to Lead + Public Lead Capture
  const aiPostRes = await app.inject({
    method: 'POST',
    url: '/api/v1/social/posts/ai-generate',
    headers: auth,
    payload: { platform: 'instagram', topicHint: 'Impressão 3D sob medida' },
  });
  assert.equal(aiPostRes.statusCode, 201);
  const post = aiPostRes.json();
  assert.equal(post.status, 'PENDING_APPROVAL');

  const pubRes = await app.inject({
    method: 'POST',
    url: `/api/v1/social/posts/${post.id}/approve-publish`,
    headers: auth,
  });
  assert.equal(pubRes.statusCode, 201);
  assert.equal(pubRes.json().status, 'PUBLISHED');

  const capRes = await app.inject({
    method: 'POST',
    url: `/api/v1/social/posts/${post.id}/convert-lead`,
    headers: auth,
    payload: { name: 'Interessado Instagram', phoneE164: '+5511966665555' },
  });
  assert.equal(capRes.statusCode, 201);
  assert.equal(capRes.json().source, 'social_comment');

  // Public landing page lead capture
  const [orgRow] = await dbService.db
    .select({ slug: organizations.slug })
    .from(organizations)
    .where(eq(organizations.id, tenant.user.organizationId))
    .limit(1);

  const pubLeadRes = await app.inject({
    method: 'POST',
    url: `/api/v1/leads/public/${orgRow!.slug}`,
    payload: { name: 'Visitante Landing', phoneE164: '+5511955554444' },
  });
  assert.equal(pubLeadRes.statusCode, 201);

  const leadsList = await app.inject({
    method: 'GET',
    url: '/api/v1/leads',
    headers: auth,
  });
  assert.equal(leadsList.json().length, 2);
});
