import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import {
  and,
  asc,
  conversations,
  customers,
  desc,
  eq,
  messages,
} from '@al/database';
import type { ConversationBotState } from '@al/shared';
import { appEnv } from '../config/env';
import { DatabaseService } from '../database/database.module';
import { EvolutionMessagingProvider } from './messaging.provider';

export const QUEUE_OS_NOTIFICATIONS = 'os-notifications';
export const QUEUE_WHATSAPP_INBOUND = 'whatsapp-inbound';

export interface OsNotificationJobData {
  organizationId: string;
  serviceOrderId: string;
  eventType: 'repair.received' | 'repair.status_changed';
  portalUrl?: string;
}

export interface WhatsappDebounceJobData {
  organizationId: string;
  conversationId: string;
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(EvolutionMessagingProvider)
    private readonly messaging: EvolutionMessagingProvider,
    @InjectQueue(QUEUE_OS_NOTIFICATIONS)
    private readonly osNotificationsQueue: Queue<OsNotificationJobData>,
    @InjectQueue(QUEUE_WHATSAPP_INBOUND)
    private readonly whatsappInboundQueue: Queue<WhatsappDebounceJobData>,
  ) {}

  async enqueueOsNotification(data: OsNotificationJobData): Promise<void> {
    await this.osNotificationsQueue.add(data.eventType, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 50,
    });
  }

  async findOrCreateConversation(
    organizationId: string,
    phoneE164: string,
    customerId?: string | null,
  ) {
    return this.database.withTenant(organizationId, async (tx) => {
      const existing = await tx
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.organizationId, organizationId),
            eq(conversations.channel, 'whatsapp'),
            eq(conversations.externalThreadId, phoneE164),
          ),
        )
        .limit(1);

      if (existing[0]) {
        return existing[0];
      }

      const [created] = await tx
        .insert(conversations)
        .values({
          organizationId,
          customerId: customerId ?? null,
          channel: 'whatsapp',
          externalThreadId: phoneE164,
          botState: 'BOT_ACTIVE',
          lastMessageAt: new Date(),
        })
        .returning();

      return created!;
    });
  }

  async recordInboundAndDebounce(params: {
    organizationId: string;
    phoneE164: string;
    text: string;
    providerMessageId?: string;
    isAudio?: boolean;
  }) {
    const cleanDigits = params.phoneE164.replace(/\D/g, '');
    const normalizedPhone = cleanDigits.startsWith('55')
      ? `+${cleanDigits}`
      : `+55${cleanDigits}`;

    const matchedCustomer = await this.database.withTenant(
      params.organizationId,
      (tx) =>
        tx
          .select({ id: customers.id })
          .from(customers)
          .where(eq(customers.phoneE164, normalizedPhone))
          .limit(1),
    );

    const conv = await this.findOrCreateConversation(
      params.organizationId,
      normalizedPhone,
      matchedCustomer[0]?.id ?? null,
    );

    const providerMsgId = params.providerMessageId ?? `in-${randomUUID()}`;
    const audioTranscript = params.isAudio
      ? `[Áudio transcrito]: ${params.text}`
      : null;

    await this.database.withTenant(params.organizationId, async (tx) => {
      await tx
        .insert(messages)
        .values({
          organizationId: params.organizationId,
          conversationId: conv.id,
          direction: 'inbound',
          senderType: 'customer',
          contentText: params.isAudio ? 'Mensagem de áudio recebida' : params.text,
          audioTranscript,
          providerMessageId: providerMsgId,
        })
        .onConflictDoNothing();

      const nextState: ConversationBotState =
        conv.botState === 'RESOLVED' ? 'BOT_ACTIVE' : (conv.botState as ConversationBotState);

      await tx
        .update(conversations)
        .set({
          botState: nextState,
          lastMessageAt: new Date(),
        })
        .where(eq(conversations.id, conv.id));
    });

    // Debounce de mensagens em rajada via BullMQ
    const debounceJobId = `debounce-${conv.id}`;
    const existingJob = await this.whatsappInboundQueue.getJob(debounceJobId);
    if (existingJob) {
      await existingJob.remove().catch(() => undefined);
    }

    await this.whatsappInboundQueue.add(
      'process-inbound',
      {
        organizationId: params.organizationId,
        conversationId: conv.id,
      },
      {
        jobId: debounceJobId,
        delay: appEnv.WHATSAPP_DEBOUNCE_MS,
        removeOnComplete: 50,
      },
    );

    return { conversationId: conv.id, debouncedMs: appEnv.WHATSAPP_DEBOUNCE_MS };
  }

  async sendHumanReply(params: {
    organizationId: string;
    conversationId: string;
    userId: string;
    text: string;
  }) {
    const conv = await this.database.withTenant(
      params.organizationId,
      (tx) =>
        tx
          .select()
          .from(conversations)
          .where(eq(conversations.id, params.conversationId))
          .limit(1),
    );

    if (!conv[0]) {
      throw new Error('Conversa não encontrada.');
    }

    const delivery = await this.messaging.sendText({
      toPhoneE164: conv[0].externalThreadId,
      text: params.text,
    });

    return this.database.withTenant(params.organizationId, async (tx) => {
      const [msg] = await tx
        .insert(messages)
        .values({
          organizationId: params.organizationId,
          conversationId: params.conversationId,
          direction: 'outbound',
          senderType: 'human_agent',
          contentText: params.text,
          providerMessageId: delivery.providerMessageId,
        })
        .returning();

      await tx
        .update(conversations)
        .set({
          botState: 'HUMAN_ACTIVE',
          assignedUserId: params.userId,
          lastMessageAt: new Date(),
        })
        .where(eq(conversations.id, params.conversationId));

      return { message: msg!, deliveredVia: delivery.deliveredVia };
    });
  }

  async listConversations(organizationId: string) {
    return this.database.withTenant(organizationId, async (tx) => {
      const rows = await tx
        .select({
          id: conversations.id,
          channel: conversations.channel,
          externalThreadId: conversations.externalThreadId,
          botState: conversations.botState,
          handoffReason: conversations.handoffReason,
          handoffSummary: conversations.handoffSummary,
          lastMessageAt: conversations.lastMessageAt,
          customerId: conversations.customerId,
          customerName: customers.name,
        })
        .from(conversations)
        .leftJoin(customers, eq(conversations.customerId, customers.id))
        .orderBy(desc(conversations.lastMessageAt))
        .limit(50);
      return rows;
    });
  }

  async listMessages(organizationId: string, conversationId: string) {
    return this.database.withTenant(organizationId, (tx) =>
      tx
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(asc(messages.createdAt)),
    );
  }

  async updateBotState(
    organizationId: string,
    conversationId: string,
    botState: ConversationBotState,
  ) {
    return this.database.withTenant(organizationId, async (tx) => {
      const [updated] = await tx
        .update(conversations)
        .set({
          botState,
          ...(botState === 'BOT_ACTIVE'
            ? { handoffReason: null, handoffSummary: null }
            : {}),
        })
        .where(eq(conversations.id, conversationId))
        .returning();
      return updated;
    });
  }
}
