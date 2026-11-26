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
  financialTransactions,
  serviceOrders,
  serviceOrderEvents,
  osDiagnostics,
  quotes,
  quoteItems,
  suppliers,
  products,
  productSuppliers,
  purchaseOrders,
  purchaseOrderItems,
  fiscalProfiles,
  filaments,
  print3dJobs,
  projects,
  projectTasks,
  socialPosts,
  knowledgeDocuments,
  knowledgeChunks,
  conversations,
  messages,
  hardwareDiagnosticSnapshots,
  warrantyCases,
  maintenanceContracts,
  sourcingRequests,
  sourcingOffers,
  checklistTemplates,
  automationRules,
  serviceCatalogItems,
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

    const [demoOs] = await db
      .select()
      .from(serviceOrders)
      .where(
        and(
          eq(serviceOrders.organizationId, orgId),
          eq(serviceOrders.code, 'OS-2026-0001'),
        ),
      )
      .limit(1);

    if (demoOs) {
      const existingDiag = await db
        .select({ id: osDiagnostics.id })
        .from(osDiagnostics)
        .where(eq(osDiagnostics.serviceOrderId, demoOs.id))
        .limit(1);

      if (existingDiag.length === 0) {
        await db.insert(osDiagnostics).values({
          organizationId: orgId,
          serviceOrderId: demoOs.id,
          category: 'superaquecimento',
          observedFacts:
            'CPU atingindo 99°C em idle + saída de ar obstruída por poeira compactada; pasta térmica original completamente ressecada.',
          testsPerformed: [
            { name: 'Teste de estresse térmico (10 min)', passed: false, notes: 'Thermal throttling em 99°C' },
            { name: 'Verificação SMART NVMe', passed: true, notes: 'Saúde 94%' },
            { name: 'Teste de memória RAM', passed: true },
          ],
          aiHypotheses: [
            'Limpeza interna + troca por pasta térmica de alta condutividade resolve o desligamento.',
            'Caso o cooler apresente ruído após limpeza, avaliar substituição da ventoinha.',
          ],
          finalDiagnosis:
            'Obstrução severa do sistema de arrefecimento e degradação da pasta térmica.',
          confidenceLevel: 'high',
          clientExplanation:
            'Seu notebook está esquentando e desligando por proteção porque a saída de ar acumulou poeira e a pasta térmica perdeu eficiência. Recomendamos limpeza completa e renovação térmica.',
          createdByUserId: userId,
        });
      }

      const existingQuotes = await db
        .select({ id: quotes.id })
        .from(quotes)
        .where(eq(quotes.serviceOrderId, demoOs.id))
        .limit(1);

      if (existingQuotes.length === 0) {
        const validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const [qRec] = await db
          .insert(quotes)
          .values({
            organizationId: orgId,
            serviceOrderId: demoOs.id,
            code: 'ORC-2026-0001',
            tier: 'recommended',
            status: 'SENT',
            warrantyDays: 90,
            validUntil,
            paymentTerms: 'PIX com 5% de desconto ou até 3x sem juros',
            clientNotes: 'Inclui limpeza ultrassônica das aletas e pasta térmica de prata.',
            subtotalCents: 28000,
            discountCents: 0,
            totalCents: 28000,
            estimatedCostCents: 4500,
          })
          .returning({ id: quotes.id });

        await db.insert(quoteItems).values([
          {
            organizationId: orgId,
            quoteId: qRec!.id,
            itemType: 'labor',
            description: 'Limpeza técnica completa do sistema de arrefecimento',
            quantity: 1,
            unitCostCents: 0,
            unitPriceCents: 18000,
            totalPriceCents: 18000,
          },
          {
            organizationId: orgId,
            quoteId: qRec!.id,
            itemType: 'part',
            description: 'Pasta térmica alta condutividade (aplicação CPU + GPU)',
            quantity: 1,
            unitCostCents: 4500,
            unitPriceCents: 10000,
            totalPriceCents: 10000,
          },
        ]);
      }
    }

    const existingProds = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.organizationId, orgId))
      .limit(1);

    if (existingProds.length === 0) {
      await db.insert(suppliers).values({
        organizationId: orgId,
        name: 'Distribuidora TechBR Atacado',
        cnpj: '12.345.678/0001-99',
        email: 'compras@techbr.exemplo.com',
        phone: '+551133334444',
        leadTimeDays: 2,
      });

      await db.insert(products).values([
        {
          organizationId: orgId,
          sku: 'SSD-NVME-500',
          barcode: '7890001000011',
          name: 'SSD NVMe M.2 500GB PCIe 4.0',
          category: 'armazenamento',
          brand: 'Kingston',
          costCents: 18500,
          priceCents: 31900,
          stockQty: 8,
          minStockQty: 3,
          ncm: '84717040',
        },
        {
          organizationId: orgId,
          sku: 'RAM-DDR4-16G',
          barcode: '7890001000028',
          name: 'Memória Notebook 16GB DDR4 3200MHz',
          category: 'memoria',
          brand: 'Crucial',
          costCents: 16000,
          priceCents: 27900,
          stockQty: 5,
          minStockQty: 2,
          ncm: '84733042',
        },
        {
          organizationId: orgId,
          sku: 'PASTA-TERM-4G',
          barcode: '7890001000035',
          name: 'Pasta Térmica Alta Condutividade 4g',
          category: 'insumos',
          brand: 'Arctic',
          costCents: 3200,
          priceCents: 7500,
          stockQty: 2,
          minStockQty: 3,
          ncm: '38249989',
        },
        {
          organizationId: orgId,
          sku: 'CABO-USBC-2M',
          barcode: '7890001000042',
          name: 'Cabo USB-C 100W PD Nylon 2m',
          category: 'acessorios',
          brand: 'Ugreen',
          costCents: 2400,
          priceCents: 6900,
          stockQty: 14,
          minStockQty: 4,
          ncm: '85444200',
        },
      ]);
    }

    await db
      .insert(fiscalProfiles)
      .values({
        organizationId: orgId,
        taxRegime: 'SIMPLES_NACIONAL',
        stateUf: 'SP',
        cityCode: '3550308',
        providerName: 'sandbox',
      })
      .onConflictDoNothing();

    const existingFilaments = await db
      .select({ id: filaments.id })
      .from(filaments)
      .where(eq(filaments.organizationId, orgId))
      .limit(1);

    if (existingFilaments.length === 0) {
      const [pla] = await db
        .insert(filaments)
        .values([
          {
            organizationId: orgId,
            name: 'PLA Silk Grafite',
            materialType: 'PLA',
            color: 'Grafite Metálico',
            brand: '3DLab',
            costPerKgCents: 11500,
            stockGrams: 1850,
            minGrams: 300,
          },
          {
            organizationId: orgId,
            name: 'PETG Preto Técnico',
            materialType: 'PETG',
            color: 'Preto',
            brand: 'Voolt3D',
            costPerKgCents: 13000,
            stockGrams: 950,
            minGrams: 300,
          },
        ])
        .returning({ id: filaments.id });

      await db.insert(print3dJobs).values({
        organizationId: orgId,
        filamentId: pla!.id,
        code: '3D-2026-0001',
        modelName: 'Suporte Articulado Notebook + Hub USB',
        status: 'READY',
        weightGrams: 145,
        printTimeMinutes: 260,
        totalCostCents: 3820,
        salePriceCents: 8900,
        notes: 'Infill 25% Gyroid, camada 0.2mm',
      });
    }

    const existingProjects = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.organizationId, orgId))
      .limit(1);

    if (existingProjects.length === 0) {
      const [prj] = await db
        .insert(projects)
        .values({
          organizationId: orgId,
          code: 'PRJ-2026-0001',
          title: 'Portal Interno & Automação WhatsApp — Cliente Corporativo',
          projectType: 'automation_ai',
          budgetCents: 450000,
          retainerMinutesMonthly: 1200,
          hourlyRateCents: 18000,
        })
        .returning({ id: projects.id });

      await db.insert(projectTasks).values([
        {
          organizationId: orgId,
          projectId: prj!.id,
          title: 'Configurar webhook Evolution API + debounce',
          status: 'DONE',
          priority: 'HIGH',
          estimatedMinutes: 180,
        },
        {
          organizationId: orgId,
          projectId: prj!.id,
          title: 'Integrar painel de aprovação de orçamentos',
          status: 'IN_PROGRESS',
          priority: 'HIGH',
          estimatedMinutes: 240,
        },
        {
          organizationId: orgId,
          projectId: prj!.id,
          title: 'Publicar dashboard de métricas semanais',
          status: 'BACKLOG',
          priority: 'NORMAL',
          estimatedMinutes: 120,
        },
      ]);
    }

    const existingSocial = await db
      .select({ id: socialPosts.id })
      .from(socialPosts)
      .where(eq(socialPosts.organizationId, orgId))
      .limit(1);

    if (existingSocial.length === 0) {
      await db.insert(socialPosts).values({
        organizationId: orgId,
        platform: 'instagram',
        status: 'PUBLISHED',
        title: 'Antes e depois: limpeza térmica em notebook gamer',
        caption:
          'Seu notebook está esquentando e perdendo desempenho? Aqui na AL Tech fazemos diagnóstico térmico completo e troca por pasta de alta condutividade com garantia de 90 dias.',
        hashtags: '#assistenciatecnica #manutencaonotebook #altech',
        publishedAt: new Date(),
        impressions: 1420,
        likes: 94,
        commentsCount: 12,
        leadsGenerated: 3,
      });
    }

    const existingDocs = await db
      .select({ id: knowledgeDocuments.id })
      .from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.organizationId, orgId))
      .limit(1);

    if (existingDocs.length === 0) {
      const warrantyContent =
        'Política de Garantia e Atendimento AL Tech: Todos os reparos em notebooks, desktops e substituições de peças possuem garantia padrão de 90 dias contra defeitos no serviço executado. Horário de funcionamento: segunda a sexta das 09h às 18h e sábados das 09h às 13h. Diagnóstico inicial gratuito em até 48 horas úteis.';
      const thermalSopContent =
        'Procedimento Técnico de Superaquecimento: Ao receber notebook que desliga por temperatura, executar teste de estresse por 10 minutos, medir rotação do cooler, inspecionar aletas de cobre e substituir pasta térmica ressecada por composto de alta condutividade térmica.';

      const [doc1] = await db
        .insert(knowledgeDocuments)
        .values({
          organizationId: orgId,
          title: 'Política de Garantia e Horários — AL Tech',
          sourceType: 'policy',
          sha256: createHash('sha256').update(warrantyContent).digest('hex'),
          storageKey: 'kb/seed-garantia.txt',
        })
        .returning({ id: knowledgeDocuments.id });

      const [doc2] = await db
        .insert(knowledgeDocuments)
        .values({
          organizationId: orgId,
          title: 'SOP Técnico: Diagnóstico de Superaquecimento',
          sourceType: 'sop',
          sha256: createHash('sha256').update(thermalSopContent).digest('hex'),
          storageKey: 'kb/seed-sop-termico.txt',
        })
        .returning({ id: knowledgeDocuments.id });

      await db.insert(knowledgeChunks).values([
        {
          organizationId: orgId,
          documentId: doc1!.id,
          chunkIndex: 0,
          content: warrantyContent,
          metadata: { source: 'Política de Garantia e Horários — AL Tech' },
        },
        {
          organizationId: orgId,
          documentId: doc2!.id,
          chunkIndex: 0,
          content: thermalSopContent,
          metadata: { source: 'SOP Técnico: Diagnóstico de Superaquecimento' },
        },
      ]);
    }

    // Seed adicional para gráficos BI e pipeline Kanban realistas
    const existingOsAll = await db
      .select({ code: serviceOrders.code })
      .from(serviceOrders)
      .where(eq(serviceOrders.organizationId, orgId));

    const existingCustList = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.organizationId, orgId))
      .limit(1);

    if (existingCustList[0] && existingOsAll.length < 2) {
      const custId = existingCustList[0].id;
      const now = Date.now();
      const extraOrders = [
        {
          code: 'OS-2026-0002',
          status: 'IN_REPAIR',
          priority: 'URGENT',
          reportedSymptoms: 'MacBook Pro M1 sem carregar pela porta USB-C direita.',
          preliminaryDiagnosis: 'Possível falha no controlador CD3217 ou placa de carga.',
          createdAt: new Date(now - 2 * 86400000),
        },
        {
          code: 'OS-2026-0003',
          status: 'QUOTE_SENT',
          priority: 'HIGH',
          reportedSymptoms: 'Desktop Ryzen travando em jogos e SSD com alerta SMART.',
          preliminaryDiagnosis: 'NVMe degradado; orçamento enviado com opção de SSD 1TB.',
          createdAt: new Date(now - 1 * 86400000),
        },
        {
          code: 'OS-2026-0004',
          status: 'READY',
          priority: 'NORMAL',
          reportedSymptoms: 'Troca de tela LED 15.6" Full HD + calibração de dobradiças.',
          preliminaryDiagnosis: 'Painel eDP substituído e aprovado em teste de bancada.',
          createdAt: new Date(now - 4 * 86400000),
        },
      ];

      for (const item of extraOrders) {
        if (!existingOsAll.some((o) => o.code === item.code)) {
          await db.insert(serviceOrders).values({
            organizationId: orgId,
            code: item.code,
            customerId: custId,
            status: item.status,
            priority: item.priority,
            reportedSymptoms: item.reportedSymptoms,
            preliminaryDiagnosis: item.preliminaryDiagnosis,
            intakeChecklist: { chargerIncluded: true },
            portalTokenHash: createHash('sha256')
              .update(`seed-${item.code}`)
              .digest('hex'),
            createdAt: item.createdAt,
            updatedAt: item.createdAt,
          });
        }
      }
    }

    const existingTx = await db
      .select({ id: financialTransactions.id })
      .from(financialTransactions)
      .where(eq(financialTransactions.organizationId, orgId))
      .limit(1);

    if (existingTx.length === 0) {
      const today = new Date();
      const dayOffset = (days: number) => {
        const d = new Date(today);
        d.setDate(today.getDate() - days);
        return d;
      };

      await db.insert(financialTransactions).values([
        {
          organizationId: orgId,
          type: 'receivable',
          status: 'CONFIRMED',
          category: 'servicos_bancada',
          description: 'Manutenção preventiva + troca de pasta térmica',
          amountCents: 38000,
          paymentMethod: 'PIX',
          dueDate: dayOffset(5),
          paidAt: dayOffset(5),
          createdAt: dayOffset(5),
        },
        {
          organizationId: orgId,
          type: 'payable',
          status: 'CONFIRMED',
          category: 'pecas_estoque',
          description: 'Reposição NVMe Kingston + kits térmicos',
          amountCents: 21500,
          paymentMethod: 'BOLETO',
          dueDate: dayOffset(4),
          paidAt: dayOffset(4),
          createdAt: dayOffset(4),
        },
        {
          organizationId: orgId,
          type: 'pos_sale',
          status: 'CONFIRMED',
          category: 'pdv_balcao',
          description: 'Venda PDV — Cabo USB-C 100W + Fonte GaN',
          amountCents: 25900,
          paymentMethod: 'CREDIT_CARD',
          dueDate: dayOffset(3),
          paidAt: dayOffset(3),
          createdAt: dayOffset(3),
        },
        {
          organizationId: orgId,
          type: 'receivable',
          status: 'CONFIRMED',
          category: 'upgrade_hardware',
          description: 'Upgrade SSD 1TB + 16GB DDR4 Workstation',
          amountCents: 74000,
          paymentMethod: 'PIX',
          dueDate: dayOffset(2),
          paidAt: dayOffset(2),
          createdAt: dayOffset(2),
        },
        {
          organizationId: orgId,
          type: 'payable',
          status: 'CONFIRMED',
          category: 'infra_energia',
          description: 'Licença SaaS & Energia Laboratório',
          amountCents: 19000,
          paymentMethod: 'PIX',
          dueDate: dayOffset(1),
          paidAt: dayOffset(1),
          createdAt: dayOffset(1),
        },
        {
          organizationId: orgId,
          type: 'receivable',
          status: 'CONFIRMED',
          category: 'impressao_3d',
          description: 'Lote peças PETG Técnico (3D-2026-0001)',
          amountCents: 49500,
          paymentMethod: 'PIX',
          dueDate: dayOffset(0),
          paidAt: dayOffset(0),
          createdAt: dayOffset(0),
        },
        {
          organizationId: orgId,
          type: 'receivable',
          status: 'PENDING',
          category: 'orcamento_os',
          description: 'Aguardando aprovação/pagamento OS-2026-0001',
          amountCents: 28000,
          paymentMethod: 'PIX',
          dueDate: dayOffset(1),
          createdAt: dayOffset(2),
        },
      ]);
    }

    // Seed Fase 7: Snapshots Hardware Antes/Depois, Garantia/RMA e Contrato B2B SLA
    if (demoOs && existingCustList[0]) {
      const existingSnap = await db
        .select({ id: hardwareDiagnosticSnapshots.id })
        .from(hardwareDiagnosticSnapshots)
        .where(eq(hardwareDiagnosticSnapshots.serviceOrderId, demoOs.id))
        .limit(1);

      if (existingSnap.length === 0) {
        await db.insert(hardwareDiagnosticSnapshots).values([
          {
            organizationId: orgId,
            serviceOrderId: demoOs.id,
            assetId: demoOs.assetId,
            stage: 'BEFORE',
            source: 'windows_collector',
            cpuModel: 'Intel Core i5-1235U',
            ramGb: 8,
            storageSummary: 'NVMe 256GB Micron',
            smartHealthPct: 68,
            batteryHealthPct: 79,
            osVersion: 'Windows 11 Home 23H2',
            cpuTempCelsius: 99,
            notes: 'Pasta térmica ressecada e saída obstruída.',
            capturedByUserId: userId,
          },
          {
            organizationId: orgId,
            serviceOrderId: demoOs.id,
            assetId: demoOs.assetId,
            stage: 'AFTER',
            source: 'windows_collector',
            cpuModel: 'Intel Core i5-1235U',
            ramGb: 16,
            storageSummary: 'NVMe 1TB Kingston NV2',
            smartHealthPct: 100,
            batteryHealthPct: 79,
            osVersion: 'Windows 11 Home 24H2',
            cpuTempCelsius: 63,
            notes: 'Limpeza ultrassônica, pasta térmica prata e upgrade concluídos.',
            capturedByUserId: userId,
          },
        ]);
      }

      const existingWarranty = await db
        .select({ id: warrantyCases.id })
        .from(warrantyCases)
        .where(eq(warrantyCases.organizationId, orgId))
        .limit(1);

      if (existingWarranty.length === 0) {
        await db.insert(warrantyCases).values({
          organizationId: orgId,
          serviceOrderId: demoOs.id,
          assetId: demoOs.assetId,
          customerId: demoOs.customerId,
          code: 'GAR-2026-0001',
          kind: 'service',
          status: 'ACTIVE',
          warrantyDays: 90,
          expiresAt: new Date(Date.now() + 90 * 86400000),
          partDescription: 'Limpeza Térmica + NVMe Kingston',
          notes: 'Garantia padrão de serviço e componente instalado.',
        });
      }
    }

    const existingContract = await db
      .select({ id: maintenanceContracts.id })
      .from(maintenanceContracts)
      .where(eq(maintenanceContracts.organizationId, orgId))
      .limit(1);

    if (existingContract.length === 0 && existingCustList[0]) {
      await db.insert(maintenanceContracts).values({
        organizationId: orgId,
        customerId: existingCustList[0].id,
        code: 'CTR-2026-0001',
        title: 'Plano Preventivo + Suporte TI Mensal (10 Estações)',
        planTier: 'preventive',
        status: 'ACTIVE',
        monthlyPriceCents: 149000,
        includedHours: 12,
        usedHours: 3,
        slaResponseHours: 4,
        coveredAssetsCount: 10,
        preventiveFrequencyDays: 60,
        nextPreventiveAt: new Date(Date.now() + 14 * 86400000),
        notes: 'Inclui revisão térmica trimestral, monitoramento SMART e atendimento prioritário.',
      });
    }

    // Seed Fase 8: Marcar ativo demo como VIP Loja + Cotação B2B vs Marketplace PF
    if (demoOs?.assetId) {
      await db
        .update(assets)
        .set({
          acquiredFromStore: true,
          purchasedAt: new Date(Date.now() - 120 * 86400000),
          storeSaleRef: 'NF-AL-0042',
          vipDiscountPct: 20,
        })
        .where(eq(assets.id, demoOs.assetId));
    }

    const existingSourcing = await db
      .select({ id: sourcingRequests.id })
      .from(sourcingRequests)
      .where(eq(sourcingRequests.organizationId, orgId))
      .limit(1);

    if (existingSourcing.length === 0) {
      const [cot] = await db
        .insert(sourcingRequests)
        .values({
          organizationId: orgId,
          code: 'COT-2026-0001',
          itemName: 'SSD NVMe Kingston NV2 1TB PCIe 4.0',
          category: 'armazenamento',
          desiredQty: 2,
          targetResalePriceCents: 54900,
          urgency: 'normal',
          status: 'OPEN',
          aiRecommendation:
            'Marketplace PF (Mercado Livre Full) está R$ 37,00/un mais barato que o distribuidor B2B no custo posto com frete, garantindo margem bruta de 38%.',
        })
        .returning({ id: sourcingRequests.id });

      await db.insert(sourcingOffers).values([
        {
          organizationId: orgId,
          requestId: cot!.id,
          channelType: 'supplier_b2b',
          vendorName: 'Distribuidora TechBR Atacado (B2B)',
          unitPriceCents: 34500,
          shippingCents: 4200,
          taxOrFeeCents: 1800,
          landedUnitCostCents: 37500,
          deliveryDays: 4,
          paymentTerms: '28 dias boleto CNPJ',
          notes: 'Emite NF-e de entrada; frete CIF apenas acima de R$ 2.500.',
        },
        {
          organizationId: orgId,
          requestId: cot!.id,
          channelType: 'marketplace_pf',
          vendorName: 'Mercado Livre Full (Compra PF)',
          unitPriceCents: 33800,
          shippingCents: 0,
          taxOrFeeCents: 0,
          landedUnitCostCents: 33800,
          deliveryDays: 1,
          paymentTerms: 'PIX / Cartão à vista',
          sourceUrl: 'https://www.mercadolivre.com.br/',
          notes: 'Frete grátis Full amanhã; ideal para reposição rápida de bancada.',
        },
      ]);
    }

    // Seed Fase 9: Checklists por categoria + Motor de Regras de Automação
    const existingChecklists = await db
      .select({ id: checklistTemplates.id })
      .from(checklistTemplates)
      .where(eq(checklistTemplates.organizationId, orgId))
      .limit(1);

    if (existingChecklists.length === 0) {
      await db.insert(checklistTemplates).values([
        {
          organizationId: orgId,
          category: 'notebook',
          title: 'Checklist Bancada — Notebook',
          blockClosingIfIncomplete: true,
          items: [
            { key: 'stress_test', label: 'Teste de estresse térmico (10 min) aprovado', required: true },
            { key: 'battery_charge', label: 'Circuito de carga e bateria validados', required: true },
            { key: 'keyboard_io', label: 'Teclado, touchpad, portas USB e HDMI testados', required: true },
            { key: 'clean_chassis', label: 'Higienização externa e lacre técnico', required: false },
          ],
        },
        {
          organizationId: orgId,
          category: 'desktop',
          title: 'Checklist Bancada — Desktop / PC Gamer',
          blockClosingIfIncomplete: true,
          items: [
            { key: 'memtest', label: 'Teste de estabilidade Memória RAM / XMP', required: true },
            { key: 'cable_mgmt', label: 'Organização de cabos e fluxo de ar conferidos', required: true },
            { key: 'bios_temps', label: 'Temperaturas CPU/GPU em carga dentro da faixa', required: true },
          ],
        },
        {
          organizationId: orgId,
          category: 'impressora-3d',
          title: 'Checklist Bancada — Impressora 3D',
          blockClosingIfIncomplete: true,
          items: [
            { key: 'bed_level', label: 'Nivelamento da mesa e Z-offset calibrados', required: true },
            { key: 'extrusion', label: 'Teste de extrusão e retração sem entupimento', required: true },
            { key: 'print_sample', label: 'Peça de teste impressa com sucesso', required: false },
          ],
        },
      ]);
    }

    const existingRules = await db
      .select({ id: automationRules.id })
      .from(automationRules)
      .where(eq(automationRules.organizationId, orgId))
      .limit(1);

    if (existingRules.length === 0) {
      await db.insert(automationRules).values([
        {
          organizationId: orgId,
          name: 'Follow-up de Orçamento Pendente (48h)',
          triggerEvent: 'quote.pending_followup',
          channel: 'whatsapp',
          delayHours: 48,
          templateText:
            'Olá! Passando para saber se conseguiu analisar o orçamento do seu equipamento. Qualquer dúvida técnica estou à disposição!',
          isActive: true,
        },
        {
          organizationId: orgId,
          name: 'Lembrete de Retirada (OS Pronta há 24h)',
          triggerEvent: 'os.ready_pickup_reminder',
          channel: 'whatsapp',
          delayHours: 24,
          templateText:
            'Seu equipamento já está pronto e testado na bancada aguardando retirada em nossa loja.',
          isActive: true,
        },
        {
          organizationId: orgId,
          name: 'Alerta Preventivo de Estoque Crítico',
          triggerEvent: 'stock.low_alert',
          channel: 'internal_alert',
          delayHours: 0,
          templateText:
            'Item abaixo do estoque mínimo — abrir cotação comparativa B2B vs Marketplace PF.',
          isActive: true,
        },
      ]);
    }

    // Seed Fase 10: Catálogo de Serviços Padronizados
    const existingCatalog = await db
      .select({ id: serviceCatalogItems.id })
      .from(serviceCatalogItems)
      .where(eq(serviceCatalogItems.organizationId, orgId))
      .limit(1);

    if (existingCatalog.length === 0) {
      await db.insert(serviceCatalogItems).values([
        {
          organizationId: orgId,
          code: 'SRV-001',
          name: 'Limpeza Térmica Completa + Pasta Prata (Notebook/PC)',
          category: 'manutencao',
          defaultLaborCents: 18000,
          estimatedCostCents: 2500,
          defaultWarrantyDays: 90,
          estimatedHours: 2,
        },
        {
          organizationId: orgId,
          code: 'SRV-002',
          name: 'Formatação + Otimização + Backup + Pacote Drivers',
          category: 'software',
          defaultLaborCents: 15000,
          estimatedCostCents: 0,
          defaultWarrantyDays: 30,
          estimatedHours: 2,
        },
        {
          organizationId: orgId,
          code: 'SRV-003',
          name: 'Upgrade SSD NVMe + Clonagem de Sistema',
          category: 'upgrade',
          defaultLaborCents: 12000,
          estimatedCostCents: 0,
          defaultWarrantyDays: 90,
          estimatedHours: 2,
        },
        {
          organizationId: orgId,
          code: 'SRV-004',
          name: 'Substituição de Tela LED/IPS Notebook + Calibração',
          category: 'notebook',
          defaultLaborCents: 16000,
          estimatedCostCents: 0,
          defaultWarrantyDays: 90,
          estimatedHours: 2,
        },
        {
          organizationId: orgId,
          code: 'SRV-005',
          name: 'Revisão Preventiva VIP (Clientes Equipamento da Loja)',
          category: 'vip',
          defaultLaborCents: 10000,
          estimatedCostCents: 1500,
          defaultWarrantyDays: 120,
          estimatedHours: 1,
        },
      ]);
    }

    // Seed Fase 12: Enriquecimento de Fornecedores MEI, Produtos Ricos (Tabelas + Vínculos), Clientes PF/PJ, Compras e Despesas
    const allSuppliersBefore = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.organizationId, orgId));

    const meiSuppliersSeed = [
      {
        name: 'Agis Distribuição (Hardware B2B)',
        cnpj: '47.521.119/0001-32',
        email: 'comercial@agis.com.br',
        phone: '+551937412200',
        leadTimeDays: 3,
        websiteUrl: 'https://www.agis.com.br',
        paymentTerms: 'PIX / Boleto faturado 28d',
        acceptsMei: true,
        notes: 'Aceita MEI para SSDs, memórias, fontes e notebooks. Cotar antes de fechar marketplace PF.',
      },
      {
        name: 'bringIT Peças Notebook & Telas',
        cnpj: '13.841.997/0001-48',
        email: 'revenda@bringit.com.br',
        phone: '+554130498800',
        leadTimeDays: 2,
        websiteUrl: 'https://www.bringit.com.br',
        paymentTerms: 'PIX / Cartão / Boleto MEI',
        acceptsMei: true,
        notes: 'Especialista em telas LED/IPS, baterias, teclados e fontes originais de notebook.',
      },
      {
        name: 'Fujioka Distribuidor Tecnologia',
        cnpj: '01.008.842/0001-20',
        email: 'b2b@fujioka.com.br',
        phone: '+556232395000',
        leadTimeDays: 4,
        websiteUrl: 'https://www.fujiokadistribuidor.com.br',
        paymentTerms: 'PIX à vista ou Cartão 6x',
        acceptsMei: true,
        notes: 'Excelente preço para monitores, periféricos e PCs montados sob encomenda.',
      },
      {
        name: '3DLab Filamentos & Resinas',
        cnpj: '29.402.118/0001-05',
        email: 'vendas@3dlab.com.br',
        phone: '+553133902211',
        leadTimeDays: 2,
        websiteUrl: 'https://www.3dlab.com.br',
        paymentTerms: 'PIX 5% desc. / Cartão',
        acceptsMei: true,
        notes: 'Filamentos PLA Silk, PETG técnico e bicos hardened com desconto progressivo.',
      },
    ];

    for (const sSeed of meiSuppliersSeed) {
      if (!allSuppliersBefore.some((s) => s.name === sSeed.name)) {
        await db.insert(suppliers).values({
          organizationId: orgId,
          ...sSeed,
        });
      }
    }

    const supRowsAfter = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.organizationId, orgId));
    const supAgis =
      supRowsAfter.find((s) => s.name.includes('Agis')) ?? supRowsAfter[0];
    const supBringIt =
      supRowsAfter.find((s) => s.name.includes('bringIT')) ?? supRowsAfter[0];
    const sup3d =
      supRowsAfter.find((s) => s.name.includes('3DLab')) ?? supRowsAfter[0];

    // Atualizar TechBR antigo se existir sem notas/URL
    if (supRowsAfter[0] && !supRowsAfter[0].notes) {
      await db
        .update(suppliers)
        .set({
          websiteUrl: 'https://b2b.techbr.exemplo.com',
          paymentTerms: 'PIX / Boleto 21d CNPJ',
          acceptsMei: true,
          notes: 'Distribuidor parceiro para cabos, pasta térmica e insumos gerais de bancada.',
        })
        .where(eq(suppliers.id, supRowsAfter[0].id));
    }

    // Enriquecer produtos existentes e criar novos SKUs completos
    const richExtraProducts = [
      {
        sku: 'SSD-NVME-1TB',
        barcode: '7890001000059',
        name: 'SSD NVMe 1TB PCIe 4.0 M.2 2280 Kingston NV3',
        description:
          'Unidade NVMe Gen4 x4 leitura até 6000 MB/s. Ideal para notebooks e estações de trabalho com slot M.2 2280.',
        category: 'armazenamento',
        brand: 'Kingston',
        unit: 'UN',
        costCents: 31500,
        priceCents: 52900,
        wholesalePriceCents: 46900,
        vipPriceCents: 44900,
        warrantyDays: 365,
        preferredSupplierId: supAgis?.id ?? null,
        stockQty: 6,
        minStockQty: 2,
        ncm: '84717040',
      },
      {
        sku: 'TELA-156-FHD-EDP',
        barcode: '7890001000066',
        name: 'Tela 15.6" LED IPS Full HD 30 Pinos eDP Fosca',
        description:
          'Painel IPS antirreflexo 1920x1080 Slim sem abas (NanoEdge). Compatível com Dell Inspiron 15, Lenovo Ideapad e Acer Aspire.',
        category: 'telas',
        brand: 'BOE / AUO',
        unit: 'UN',
        costCents: 29500,
        priceCents: 49900,
        wholesalePriceCents: 43900,
        vipPriceCents: 41900,
        warrantyDays: 90,
        preferredSupplierId: supBringIt?.id ?? null,
        stockQty: 2,
        minStockQty: 2,
        ncm: '85249100',
      },
      {
        sku: 'BAT-DELL-INSP15',
        barcode: '7890001000073',
        name: 'Bateria Dell Inspiron 15 3520 / Vostro 3520 (41Wh 3 Células)',
        description:
          'Bateria compatível padrão OEM 11.25V 41Wh com proteção contra sobrecarga e 6 meses de garantia balcão.',
        category: 'baterias',
        brand: 'bringIT OEM',
        unit: 'UN',
        costCents: 17500,
        priceCents: 32900,
        wholesalePriceCents: 28900,
        vipPriceCents: 27900,
        warrantyDays: 180,
        preferredSupplierId: supBringIt?.id ?? null,
        stockQty: 1,
        minStockQty: 2,
        ncm: '85076000',
      },
      {
        sku: 'FONTE-GAN-65W',
        barcode: '7890001000080',
        name: 'Carregador GaN 65W USB-C Power Delivery Compacto',
        description:
          'Fonte inteligente GaN bivolt com 2 portas USB-C PD + 1 USB-A QC3.0. Compatível com MacBook, ThinkPad, Dell Latitude e smartphones.',
        category: 'acessorios',
        brand: 'Ugreen',
        unit: 'UN',
        costCents: 8900,
        priceCents: 18900,
        wholesalePriceCents: 15900,
        vipPriceCents: 14900,
        warrantyDays: 180,
        preferredSupplierId: supAgis?.id ?? null,
        stockQty: 9,
        minStockQty: 3,
        ncm: '85044021',
      },
      {
        sku: 'FIL-PLA-PRETO-1KG',
        barcode: '7890001000097',
        name: 'Filamento PLA Técnico Preto Profissional 1.75mm (1kg)',
        description:
          'Carretel selado a vácuo com tolerância ±0.02mm para peças funcionais, suportes de notebook e protótipos.',
        category: 'impressao-3d',
        brand: '3DLab',
        unit: 'RL',
        costCents: 8400,
        priceCents: 14900,
        wholesalePriceCents: 12900,
        vipPriceCents: 12500,
        warrantyDays: 90,
        preferredSupplierId: sup3d?.id ?? null,
        stockQty: 7,
        minStockQty: 3,
        ncm: '39169090',
      },
    ];

    const existingProdList = await db
      .select()
      .from(products)
      .where(eq(products.organizationId, orgId));

    // Preencher descrição e tabelas nos 4 produtos iniciais
    for (const p of existingProdList) {
      if (!p.description || !p.vipPriceCents) {
        await db
          .update(products)
          .set({
            description:
              p.description ??
              `${p.name} (${p.brand ?? 'Original'}) com conferência de qualidade em bancada e garantia balcão.`,
            wholesalePriceCents:
              p.wholesalePriceCents ?? Math.round(p.priceCents * 0.88),
            vipPriceCents: p.vipPriceCents ?? Math.round(p.priceCents * 0.85),
            preferredSupplierId: p.preferredSupplierId ?? supAgis?.id ?? null,
          })
          .where(eq(products.id, p.id));
      }
    }

    for (const np of richExtraProducts) {
      if (!existingProdList.some((p) => p.sku === np.sku)) {
        const [insertedProd] = await db
          .insert(products)
          .values({
            organizationId: orgId,
            ...np,
          })
          .returning();

        if (insertedProd && np.preferredSupplierId) {
          await db
            .insert(productSuppliers)
            .values({
              organizationId: orgId,
              productId: insertedProd.id,
              supplierId: np.preferredSupplierId,
              supplierSku: `FORN-${np.sku}`,
              lastCostCents: np.costCents,
              isPreferred: true,
              notes: 'Fornecedor principal cadastrado via guia MEI.',
            })
            .onConflictDoNothing();
        }
      }
    }

    // Seed adicional de Clientes PF/PJ e Ativos VIP
    const curCustomers = await db
      .select()
      .from(customers)
      .where(eq(customers.organizationId, orgId));

    const extraCustomersSeed = [
      {
        type: 'PJ',
        name: 'Clínica Odonto Sorriso Ltda',
        phoneE164: '+5511988112233',
        email: 'ti@odontosorriso.com.br',
        tags: ['pj', 'contrato-mensal'],
        aiSegment: 'VIP_B2B',
      },
      {
        type: 'PF',
        name: 'Marina Costa Arquitetura',
        phoneE164: '+5511977223344',
        email: 'marina@costaarq.com',
        tags: ['render-3d', 'workstation'],
        aiSegment: 'RECURRING',
      },
      {
        type: 'PF',
        name: 'Lucas Ferreira (Setup Gamer)',
        phoneE164: '+5511966334455',
        email: 'lucas.ferreira@exemplo.com',
        tags: ['pc-gamer', 'vip-loja'],
        aiSegment: 'VIP_STORE',
      },
      {
        type: 'PJ',
        name: 'Escola Criativa Saber ME',
        phoneE164: '+5511955445566',
        email: 'secretaria@escolasaber.edu.br',
        tags: ['pj', 'impressao-3d', 'manutencao'],
        aiSegment: 'NEW',
      },
    ];

    for (const cSeed of extraCustomersSeed) {
      if (!curCustomers.some((c) => c.phoneE164 === cSeed.phoneE164)) {
        const [newCust] = await db
          .insert(customers)
          .values({
            organizationId: orgId,
            ...cSeed,
            lgpdConsentAt: new Date(),
          })
          .returning();

        if (newCust) {
          await db.insert(assets).values({
            organizationId: orgId,
            customerId: newCust.id,
            category: cSeed.type === 'PJ' ? 'desktop' : 'notebook',
            brand: cSeed.name.includes('Lucas') ? 'Custom Ryzen' : 'Lenovo',
            model: cSeed.name.includes('Lucas')
              ? 'Workstation R7 7700X + RTX 4070'
              : 'ThinkPad E14 Gen 5',
            serialNumber: `SN-${Math.floor(100000 + Math.random() * 899999)}`,
            qrToken: `qr-al-${newCust.id.slice(0, 8)}`,
            acquiredFromStore: cSeed.name.includes('Lucas'),
            vipDiscountPct: cSeed.name.includes('Lucas') ? 20 : 0,
            storeSaleRef: cSeed.name.includes('Lucas') ? 'NF-AL-0088' : null,
          });
        }
      }
    }

    // Garantir ao menos 2 Pedidos de Compra no histórico
    const existingPos = await db
      .select({ code: purchaseOrders.code })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.organizationId, orgId));

    const prodCatalogAfter = await db
      .select()
      .from(products)
      .where(eq(products.organizationId, orgId));
    const prodNvme = prodCatalogAfter.find((p) => p.sku === 'SSD-NVME-1TB') ?? prodCatalogAfter[0];
    const prodTela = prodCatalogAfter.find((p) => p.sku === 'TELA-156-FHD-EDP') ?? prodCatalogAfter[0];

    if (existingPos.length === 0 && supAgis && supBringIt && prodNvme && prodTela) {
      const [po1] = await db
        .insert(purchaseOrders)
        .values({
          organizationId: orgId,
          supplierId: supAgis.id,
          code: 'PO-2026-0001',
          status: 'RECEIVED',
          totalCostCents: prodNvme.costCents * 4,
          notes: 'Reposição mensal SSDs NVMe para upgrades e balcão.',
          receivedAt: new Date(Date.now() - 3 * 86400000),
        })
        .returning();

      if (po1) {
        await db.insert(purchaseOrderItems).values({
          organizationId: orgId,
          purchaseOrderId: po1.id,
          productId: prodNvme.id,
          quantity: 4,
          unitCostCents: prodNvme.costCents,
        });
      }

      const [po2] = await db
        .insert(purchaseOrders)
        .values({
          organizationId: orgId,
          supplierId: supBringIt.id,
          code: 'PO-2026-0002',
          status: 'ORDERED',
          totalCostCents: prodTela.costCents * 2,
          linkedServiceOrderId: demoOs?.id ?? null,
          expectedArrivalAt: new Date(Date.now() + 2 * 86400000),
          notes: 'Telas 15.6 IPS para reposição e reserva técnica.',
        })
        .returning();

      if (po2) {
        await db.insert(purchaseOrderItems).values({
          organizationId: orgId,
          purchaseOrderId: po2.id,
          productId: prodTela.id,
          quantity: 2,
          unitCostCents: prodTela.costCents,
        });
      }
    }

    // Garantir despesa pendente recente para ilustrar Previsto vs Realizado no Dashboard
    const existingPendingPayable = await db
      .select({ id: financialTransactions.id })
      .from(financialTransactions)
      .where(
        and(
          eq(financialTransactions.organizationId, orgId),
          eq(financialTransactions.type, 'payable'),
          eq(financialTransactions.status, 'PENDING'),
        ),
      )
      .limit(1);

    if (existingPendingPayable.length === 0) {
      await db.insert(financialTransactions).values({
        organizationId: orgId,
        type: 'payable',
        status: 'PENDING',
        category: 'Peças & Estoque',
        description: 'Pedido PO-2026-0002 bringIT (2x Telas 15.6 IPS)',
        amountCents: 59000,
        paymentMethod: 'boleto',
        dueDate: new Date(),
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
