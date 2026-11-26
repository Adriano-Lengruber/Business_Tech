import { Inject, Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { z } from 'zod';
import {
  aiAgentRuns,
  assets,
  conversations,
  customers,
  desc,
  eq,
  messages,
  organizations,
  serviceOrders,
} from '@al/database';
import { AgentToolRegistry, AiGateway, type AiPrivacyMode } from '@al/ai-core';
import { OS_STATUS_LABELS, type OsStatus } from '@al/shared';
import { appEnv } from '../config/env';
import { DatabaseService } from '../database/database.module';
import { EvolutionMessagingProvider } from './messaging.provider';
import {
  QUEUE_OS_NOTIFICATIONS,
  QUEUE_WHATSAPP_INBOUND,
  type OsNotificationJobData,
  type WhatsappDebounceJobData,
} from './whatsapp.service';

@Processor(QUEUE_OS_NOTIFICATIONS)
export class OsNotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(OsNotificationsProcessor.name);

  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(EvolutionMessagingProvider)
    private readonly messaging: EvolutionMessagingProvider,
  ) {
    super();
  }

  async process(job: Job<OsNotificationJobData>): Promise<void> {
    const { organizationId, serviceOrderId, eventType, portalUrl } = job.data;

    const details = await this.database.withTenant(organizationId, async (tx) => {
      const rows = await tx
        .select({
          osCode: serviceOrders.code,
          status: serviceOrders.status,
          symptoms: serviceOrders.reportedSymptoms,
          preliminaryDiagnosis: serviceOrders.preliminaryDiagnosis,
          customerId: customers.id,
          customerName: customers.name,
          customerPhone: customers.phoneE164,
          assetBrand: assets.brand,
          assetModel: assets.model,
          orgName: organizations.name,
        })
        .from(serviceOrders)
        .innerJoin(customers, eq(serviceOrders.customerId, customers.id))
        .innerJoin(organizations, eq(serviceOrders.organizationId, organizations.id))
        .leftJoin(assets, eq(serviceOrders.assetId, assets.id))
        .where(eq(serviceOrders.id, serviceOrderId))
        .limit(1);
      return rows[0];
    });

    if (!details) return;

    const equipLabel =
      [details.assetBrand, details.assetModel].filter(Boolean).join(' ') ||
      'Equipamento';
    const statusLabel =
      OS_STATUS_LABELS[details.status as OsStatus] ?? details.status;

    const text =
      eventType === 'repair.received'
        ? [
            `Olá ${details.customerName}! Confirmamos a entrada do seu equipamento na *${details.orgName}*.`,
            ``,
            `• *Protocolo:* ${details.osCode}`,
            `• *Equipamento:* ${equipLabel}`,
            `• *Sintomas:* ${details.symptoms}`,
            details.preliminaryDiagnosis
              ? `• *Pré-avaliação:* ${details.preliminaryDiagnosis}`
              : null,
            portalUrl ? `• *Acompanhe online:* ${portalUrl}` : null,
            ``,
            `Se tiver qualquer dúvida sobre o andamento, pode responder por aqui mesmo!`,
          ]
            .filter((line) => line !== null)
            .join('\n')
        : [
            `Atualização da sua *${details.osCode}* (${equipLabel}):`,
            `Novo status: *${statusLabel}*`,
            portalUrl ? `Acompanhe os detalhes em: ${portalUrl}` : null,
          ]
            .filter(Boolean)
            .join('\n');

    const delivery = await this.messaging.sendText({
      toPhoneE164: details.customerPhone,
      text,
    });

    await this.database.withTenant(organizationId, async (tx) => {
      let conv = (
        await tx
          .select()
          .from(conversations)
          .where(eq(conversations.externalThreadId, details.customerPhone))
          .limit(1)
      )[0];

      if (!conv) {
        [conv] = await tx
          .insert(conversations)
          .values({
            organizationId,
            customerId: details.customerId,
            channel: 'whatsapp',
            externalThreadId: details.customerPhone,
            botState: 'BOT_ACTIVE',
            lastMessageAt: new Date(),
          })
          .returning();
      }

      await tx.insert(messages).values({
        organizationId,
        conversationId: conv!.id,
        direction: 'outbound',
        senderType: 'automation',
        contentText: text,
        providerMessageId: delivery.providerMessageId,
      });

      await tx
        .update(conversations)
        .set({ lastMessageAt: new Date() })
        .where(eq(conversations.id, conv!.id));
    });

    this.logger.log(
      `Notificação ${eventType} enviada para ${details.customerPhone} via ${delivery.deliveredVia}`,
    );
  }
}

const HANDOFF_KEYWORDS = [
  'atendente',
  'humano',
  'pessoa',
  'tecnico',
  'técnico',
  'desconto',
  'reclamação',
  'reclamacao',
  'procon',
  'garantia',
  'falar com',
  'adriano',
];

@Injectable()
@Processor(QUEUE_WHATSAPP_INBOUND)
export class WhatsappInboundProcessor extends WorkerHost {
  private readonly logger = new Logger(WhatsappInboundProcessor.name);
  private readonly aiGateway = new AiGateway({
    localBaseUrl: appEnv.OLLAMA_BASE_URL,
    localChatModel: appEnv.OLLAMA_CHAT_MODEL,
    localReasoningModel: appEnv.OLLAMA_REASONING_MODEL,
  });

  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(EvolutionMessagingProvider)
    private readonly messaging: EvolutionMessagingProvider,
  ) {
    super();
  }

  async process(job: Job<WhatsappDebounceJobData>): Promise<void> {
    const { organizationId, conversationId } = job.data;
    const startMs = Date.now();

    const snapshot = await this.database.withTenant(organizationId, async (tx) => {
      const [conv] = await tx
        .select()
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1);
      if (!conv) return null;

      const [org] = await tx
        .select()
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);

      const recentMsgs = await tx
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(desc(messages.createdAt))
        .limit(8);

      const customerOrders = conv.customerId
        ? await tx
            .select({
              code: serviceOrders.code,
              status: serviceOrders.status,
              priority: serviceOrders.priority,
              reportedSymptoms: serviceOrders.reportedSymptoms,
              preliminaryDiagnosis: serviceOrders.preliminaryDiagnosis,
              promisedAt: serviceOrders.promisedAt,
              assetBrand: assets.brand,
              assetModel: assets.model,
            })
            .from(serviceOrders)
            .leftJoin(assets, eq(serviceOrders.assetId, assets.id))
            .where(eq(serviceOrders.customerId, conv.customerId))
            .orderBy(desc(serviceOrders.createdAt))
            .limit(3)
        : [];

      return {
        conv,
        orgName: org?.name ?? 'AL Tech & Soluções',
        privacyMode: (org?.aiPrivacyMode ?? 'strict_local') as AiPrivacyMode,
        recentMsgs: [...recentMsgs].reverse(),
        customerOrders,
      };
    });

    if (!snapshot || snapshot.conv.botState !== 'BOT_ACTIVE') {
      return;
    }

    const lastCustomerMsgs = snapshot.recentMsgs
      .filter((m) => m.senderType === 'customer')
      .slice(-3);
    const combinedCustomerText = lastCustomerMsgs
      .map((m) => m.audioTranscript || m.contentText || '')
      .join(' ')
      .trim();

    if (!combinedCustomerText) return;

    const normalized = combinedCustomerText.toLowerCase();
    const matchedHandoffKeyword = HANDOFF_KEYWORDS.find((kw) =>
      normalized.includes(kw),
    );

    if (matchedHandoffKeyword) {
      const latestOs = snapshot.customerOrders[0];
      const summary = [
        `Motivo: cliente mencionou "${matchedHandoffKeyword}".`,
        latestOs
          ? `OS vinculada: ${latestOs.code} (${OS_STATUS_LABELS[latestOs.status as OsStatus] ?? latestOs.status}).`
          : 'Sem OS vinculada ainda.',
        `Última mensagem: "${combinedCustomerText.slice(0, 180)}"`,
      ].join(' ');

      const handoffReply =
        'Entendi! Vou encaminhar sua conversa agora mesmo para um especialista humano da nossa equipe dar sequência com você.';

      const delivery = await this.messaging.sendText({
        toPhoneE164: snapshot.conv.externalThreadId,
        text: handoffReply,
      });

      await this.database.withTenant(organizationId, async (tx) => {
        await tx
          .update(conversations)
          .set({
            botState: 'WAITING_HUMAN',
            handoffReason: `Palavra-chave detectada: ${matchedHandoffKeyword}`,
            handoffSummary: summary,
            lastMessageAt: new Date(),
          })
          .where(eq(conversations.id, conversationId));

        await tx.insert(messages).values({
          organizationId,
          conversationId,
          direction: 'outbound',
          senderType: 'ai_agent',
          contentText: handoffReply,
          providerMessageId: delivery.providerMessageId,
        });

        await tx.insert(aiAgentRuns).values({
          organizationId,
          conversationId,
          agentName: 'whatsapp-support',
          provider: 'rule-handoff',
          model: 'deterministic-guard',
          latencyMs: Date.now() - startMs,
          toolsCalled: [{ name: 'escalate_to_human', keyword: matchedHandoffKeyword }],
          riskLevel: 'WRITE_SAFE',
        });
      });
      return;
    }

    // Tool Registry seguro (READ_ONLY) para grounding real
    const registry = new AgentToolRegistry();
    registry.register({
      name: 'get_customer_repair_orders',
      description: 'Retorna as ordens de serviço reais do cliente',
      moduleCode: 'mod-service-orders',
      riskLevel: 'READ_ONLY',
      inputSchema: z.object({}),
      execute: async () => snapshot.customerOrders,
    });

    const toolRes = await registry.invoke<typeof snapshot.customerOrders>(
      'get_customer_repair_orders',
      {},
      { organizationId, enabledModules: ['core', 'mod-service-orders'] },
    );

    const ordersData = toolRes.status === 'EXECUTED' ? toolRes.data : [];
    const latestOs = ordersData[0];

    let replyText = '';
    let usedProvider = 'grounded-fallback';
    let usedModel = 'deterministic-template';

    try {
      const contextJson = JSON.stringify(
        ordersData.map((o) => ({
          codigo: o.code,
          status: OS_STATUS_LABELS[o.status as OsStatus] ?? o.status,
          equipamento: [o.assetBrand, o.assetModel].filter(Boolean).join(' '),
          sintomas: o.reportedSymptoms,
          preDiagnostico: o.preliminaryDiagnosis,
          prazoPrometido: o.promisedAt,
        })),
      );

      const aiResult = await this.aiGateway.generateGroundedReply({
        task: 'whatsapp_support',
        privacyMode: snapshot.privacyMode,
        system: [
          `Você é o assistente de atendimento da ${snapshot.orgName}.`,
          `Responda em português brasileiro de forma educada, objetiva e clara.`,
          `Use EXCLUSIVAMENTE os dados reais abaixo. Nunca invente prazos, preços ou diagnósticos não listados.`,
          `Dados reais das OS do cliente: ${contextJson}`,
        ].join('\n'),
        prompt: combinedCustomerText,
        timeoutMs: 8000,
      });

      if (aiResult.text) {
        replyText = aiResult.text;
        usedProvider = aiResult.providerKind;
        usedModel = aiResult.modelId;
      }
    } catch (err) {
      this.logger.debug(
        `Ollama local indisponível (${(err as Error).message}); respondendo com fallback aterrado nos dados da OS.`,
      );
    }

    if (!replyText) {
      if (latestOs) {
        const statusLabel =
          OS_STATUS_LABELS[latestOs.status as OsStatus] ?? latestOs.status;
        const equip =
          [latestOs.assetBrand, latestOs.assetModel].filter(Boolean).join(' ') ||
          'seu equipamento';
        replyText = `Sua ordem *${latestOs.code}* (${equip}) está atualmente no status *${statusLabel}*.${
          latestOs.preliminaryDiagnosis
            ? ` Observação técnica registrada: ${latestOs.preliminaryDiagnosis}.`
            : ''
        } Se quiser falar com um técnico humano, basta digitar "atendente".`;
      } else {
        replyText = `Olá! Recebi sua mensagem na ${snapshot.orgName}. Ainda não encontrei uma OS vinculada a este número — se quiser falar com um atendente humano ou abrir um atendimento, digite "atendente".`;
      }
    }

    const delivery = await this.messaging.sendText({
      toPhoneE164: snapshot.conv.externalThreadId,
      text: replyText,
    });

    await this.database.withTenant(organizationId, async (tx) => {
      await tx.insert(messages).values({
        organizationId,
        conversationId,
        direction: 'outbound',
        senderType: 'ai_agent',
        contentText: replyText,
        providerMessageId: delivery.providerMessageId,
      });

      await tx
        .update(conversations)
        .set({ lastMessageAt: new Date() })
        .where(eq(conversations.id, conversationId));

      await tx.insert(aiAgentRuns).values({
        organizationId,
        conversationId,
        agentName: 'whatsapp-support',
        provider: usedProvider,
        model: usedModel,
        latencyMs: Date.now() - startMs,
        toolsCalled: [{ name: 'get_customer_repair_orders', count: ordersData.length }],
        riskLevel: 'READ_ONLY',
      });
    });
  }
}
