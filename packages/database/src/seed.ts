import { createHash } from 'node:crypto';
import { config as loadEnv } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { and, eq } from 'drizzle-orm';
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
  serviceOrderEvents,
  conversations,
  messages,
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

      const portalTokenHash = createHash('sha256')
        .update('demo-portal-token-0001')
        .digest('hex');

      const [os] = await db
        .insert(serviceOrders)
        .values({
          organizationId: orgId,
          code: 'OS-2026-0001',
          customerId: customer!.id,
          assetId: asset!.id,
          status: 'DIAGNOSIS',
          priority: 'HIGH',
          reportedSymptoms: 'Notebook superaquecendo e desligando após 15 minutos de uso.',
          preliminaryDiagnosis: 'Possível obstrução térmica / pasta térmica ressecada.',
          portalTokenHash,
          intakeChecklist: {
            chargerIncluded: true,
            caseOrBagIncluded: false,
            scratchesNoted: false,
            backupRequested: false,
            formatAuthorized: false,
            externalConditionNotes: 'Carcaça íntegra, carregador original Dell incluso.',
          },
        })
        .returning({ id: serviceOrders.id });

      await db.insert(serviceOrderEvents).values([
        {
          organizationId: orgId,
          serviceOrderId: os!.id,
          eventType: 'repair.received',
          toStatus: 'RECEIVED',
          note: 'Equipamento recebido no balcão com carregador original.',
          actorType: 'human',
          actorId: userId,
        },
        {
          organizationId: orgId,
          serviceOrderId: os!.id,
          eventType: 'repair.status_changed',
          fromStatus: 'RECEIVED',
          toStatus: 'DIAGNOSIS',
          note: 'Iniciada inspeção térmica na bancada.',
          actorType: 'human',
          actorId: userId,
        },
      ]);

      const [conv] = await db
        .insert(conversations)
        .values({
          organizationId: orgId,
          customerId: customer!.id,
          channel: 'whatsapp',
          externalThreadId: '+5511999990001',
          botState: 'BOT_ACTIVE',
          lastMessageAt: new Date(),
        })
        .returning({ id: conversations.id });

      await db.insert(messages).values([
        {
          organizationId: orgId,
          conversationId: conv!.id,
          direction: 'outbound',
          senderType: 'automation',
          contentText:
            'Olá Carlos! Sua OS-2026-0001 (Dell Inspiron 15 3520) foi registrada na AL Tech & Soluções. Acompanhe em tempo real pelo seu portal.',
          providerMessageId: 'seed-msg-0001',
        },
        {
          organizationId: orgId,
          conversationId: conv!.id,
          direction: 'inbound',
          senderType: 'customer',
          contentText: 'Obrigado! Como está o status do meu notebook?',
          providerMessageId: 'seed-msg-0002',
        },
        {
          organizationId: orgId,
          conversationId: conv!.id,
          direction: 'outbound',
          senderType: 'ai_agent',
          contentText:
            'Olá Carlos! Sua OS-2026-0001 (Dell Inspiron 15 3520) está atualmente em **Diagnóstico** na bancada. Assim que a avaliação térmica for concluída, enviaremos o orçamento por aqui.',
          providerMessageId: 'seed-msg-0003',
        },
      ]);
    } else {
      const demoCust = existingCustomers[0]!;
      const portalTokenHash = createHash('sha256')
        .update('demo-portal-token-0001')
        .digest('hex');

      const [existingOs] = await db
        .select()
        .from(serviceOrders)
        .where(
          and(
            eq(serviceOrders.organizationId, orgId),
            eq(serviceOrders.code, 'OS-2026-0001'),
          ),
        )
        .limit(1);

      if (existingOs && !existingOs.portalTokenHash) {
        await db
          .update(serviceOrders)
          .set({ portalTokenHash })
          .where(eq(serviceOrders.id, existingOs.id));

        await db.insert(serviceOrderEvents).values([
          {
            organizationId: orgId,
            serviceOrderId: existingOs.id,
            eventType: 'repair.received',
            toStatus: 'RECEIVED',
            note: 'Equipamento recebido no balcão com carregador original.',
            actorType: 'human',
            actorId: userId,
          },
          {
            organizationId: orgId,
            serviceOrderId: existingOs.id,
            eventType: 'repair.status_changed',
            fromStatus: 'RECEIVED',
            toStatus: 'DIAGNOSIS',
            note: 'Iniciada inspeção térmica na bancada.',
            actorType: 'human',
            actorId: userId,
          },
        ]);
      }

      const existingConv = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.organizationId, orgId),
            eq(conversations.externalThreadId, demoCust.phoneE164),
          ),
        )
        .limit(1);

      if (existingConv.length === 0) {
        const [conv] = await db
          .insert(conversations)
          .values({
            organizationId: orgId,
            customerId: demoCust.id,
            channel: 'whatsapp',
            externalThreadId: demoCust.phoneE164,
            botState: 'BOT_ACTIVE',
            lastMessageAt: new Date(),
          })
          .returning({ id: conversations.id });

        await db
          .insert(messages)
          .values([
            {
              organizationId: orgId,
              conversationId: conv!.id,
              direction: 'outbound',
              senderType: 'automation',
              contentText:
                'Olá Carlos! Sua OS-2026-0001 (Dell Inspiron 15 3520) foi registrada na AL Tech & Soluções. Acompanhe em tempo real pelo seu portal.',
              providerMessageId: 'seed-msg-0001',
            },
            {
              organizationId: orgId,
              conversationId: conv!.id,
              direction: 'inbound',
              senderType: 'customer',
              contentText: 'Obrigado! Como está o status do meu notebook?',
              providerMessageId: 'seed-msg-0002',
            },
            {
              organizationId: orgId,
              conversationId: conv!.id,
              direction: 'outbound',
              senderType: 'ai_agent',
              contentText:
                'Olá Carlos! Sua OS-2026-0001 (Dell Inspiron 15 3520) está atualmente em **Diagnóstico** na bancada. Assim que a avaliação térmica for concluída, enviaremos o orçamento por aqui.',
              providerMessageId: 'seed-msg-0003',
            },
          ])
          .onConflictDoNothing();
      }
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
