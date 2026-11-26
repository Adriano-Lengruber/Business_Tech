import { config as loadEnv } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import { MODULE_CODES } from '@al/shared';
import { createDb, createDbPool } from './client.js';
import { hashPassword } from './password.js';
import {
  organizations,
  users,
  memberships,
  tenantModules,
  customers,
  assets,
  serviceOrders,
} from './schema/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, '../../../.env') });

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured');
  }

  const pool = createDbPool(databaseUrl);
  const db = createDb(pool);

  try {
    const existingOrg = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, 'al-tech'))
      .limit(1);

    let orgId = existingOrg[0]?.id;

    if (!orgId) {
      const [insertedOrg] = await db
        .insert(organizations)
        .values({
          slug: 'al-tech',
          name: 'AL Tech & Soluções',
          planCode: 'enterprise_modular',
          aiPrivacyMode: 'strict_local',
          settings: { soloOperatorMode: true, timezone: 'America/Sao_Paulo' },
        })
        .returning({ id: organizations.id });
      orgId = insertedOrg!.id;
    }

    const demoEmail = 'adriano@altech.local';
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, demoEmail))
      .limit(1);

    let userId = existingUser[0]?.id;
    if (!userId) {
      const passwordHash = await hashPassword('Admin@12345');
      const [insertedUser] = await db
        .insert(users)
        .values({
          email: demoEmail,
          name: 'Adriano Lengruber',
          passwordHash,
        })
        .returning({ id: users.id });
      userId = insertedUser!.id;

      await db.insert(memberships).values({
        organizationId: orgId,
        userId,
        role: 'owner',
      });
    }

    for (const code of MODULE_CODES) {
      await db
        .insert(tenantModules)
        .values({
          organizationId: orgId,
          moduleCode: code,
          enabled: true,
        })
        .onConflictDoNothing();
    }

    const existingCustomers = await db
      .select()
      .from(customers)
      .where(eq(customers.organizationId, orgId))
      .limit(1);

    if (existingCustomers.length === 0) {
      const [customer] = await db
        .insert(customers)
        .values({
          organizationId: orgId,
          type: 'PF',
          name: 'Carlos Eduardo Silva',
          phoneE164: '+5511999990001',
          email: 'carlos.silva@exemplo.com',
          tags: ['notebook', 'cliente-recorrente'],
          aiSegment: 'RECURRING',
          lgpdConsentAt: new Date(),
        })
        .returning({ id: customers.id });

      const [asset] = await db
        .insert(assets)
        .values({
          organizationId: orgId,
          customerId: customer!.id,
          category: 'notebook',
          brand: 'Dell',
          model: 'Inspiron 15 3520',
          serialNumber: 'DL-3520-9918',
          qrToken: 'qr-al-demo-0001',
          specs: { cpu: 'Core i5-1235U', ram: '16GB', storage: '512GB NVMe' },
        })
        .returning({ id: assets.id });

      await db.insert(serviceOrders).values({
        organizationId: orgId,
        code: 'OS-2026-0001',
        customerId: customer!.id,
        assetId: asset!.id,
        status: 'DIAGNOSIS',
        priority: 'HIGH',
        reportedSymptoms: 'Notebook superaquecendo e desligando após 15 minutos de uso.',
        preliminaryDiagnosis: 'Possível obstrução térmica / pasta térmica ressecada.',
      });
    }

    console.log('[seed] Seed concluído com sucesso para AL Tech & Soluções.');
  } finally {
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('[seed] Erro:', err);
  process.exit(1);
});
