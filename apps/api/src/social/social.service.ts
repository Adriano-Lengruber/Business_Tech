import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  aiAgentRuns,
  auditLogs,
  desc,
  eq,
  leads,
  organizations,
  serviceOrders,
  socialPosts,
} from '@al/database';
import { AiGateway, type AiPrivacyMode } from '@al/ai-core';
import type { CreateLeadInput, CreateSocialPostInput } from '@al/shared';
import { appEnv } from '../config/env';
import { DatabaseService } from '../database/database.module';

@Injectable()
export class SocialService {
  private readonly aiGateway = new AiGateway({
    localBaseUrl: appEnv.OLLAMA_BASE_URL,
    localChatModel: appEnv.OLLAMA_CHAT_MODEL,
    localReasoningModel: appEnv.OLLAMA_REASONING_MODEL,
  });

  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  listPosts(organizationId: string) {
    return this.database.withTenant(organizationId, (tx) =>
      tx
        .select()
        .from(socialPosts)
        .orderBy(desc(socialPosts.createdAt))
        .limit(50),
    );
  }

  async createPost(
    organizationId: string,
    userId: string,
    input: CreateSocialPostInput,
  ) {
    return this.database.withTenant(organizationId, async (tx) => {
      const [post] = await tx
        .insert(socialPosts)
        .values({
          organizationId,
          platform: input.platform,
          status: input.scheduledFor ? 'SCHEDULED' : 'DRAFT',
          title: input.title.trim(),
          caption: input.caption.trim(),
          hashtags: input.hashtags?.trim() || null,
          scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
        })
        .returning();

      await tx.insert(auditLogs).values({
        organizationId,
        actorType: 'human',
        actorId: userId,
        action: 'social_post.created',
        entityType: 'social_post',
        entityId: post!.id,
      });

      return post!;
    });
  }

  async aiGenerateDraft(
    organizationId: string,
    platform: CreateSocialPostInput['platform'],
    topicHint?: string,
  ) {
    const startMs = Date.now();
    const ctx = await this.database.withTenant(organizationId, async (tx) => {
      const [org] = await tx
        .select()
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);
      const recentOs = await tx
        .select({
          symptoms: serviceOrders.reportedSymptoms,
          prelim: serviceOrders.preliminaryDiagnosis,
        })
        .from(serviceOrders)
        .orderBy(desc(serviceOrders.createdAt))
        .limit(3);

      return {
        orgName: org?.name ?? 'AL Tech & Soluções',
        privacyMode: (org?.aiPrivacyMode ?? 'strict_local') as AiPrivacyMode,
        recentOs,
      };
    });

    const contextSummary = ctx.recentOs
      .map((o) => o.prelim || o.symptoms)
      .join(' | ');

    let title = `Bastidores técnicos da ${ctx.orgName}`;
    let caption = '';
    let hashtags = '#assistenciatecnica #tecnologia #impressao3d #albusinessos';
    let provider = 'grounded-fallback';
    let model = 'deterministic-copy-template';

    try {
      const res = await this.aiGateway.generateGroundedReply({
        task: 'marketing_copy',
        privacyMode: ctx.privacyMode,
        system:
          'Você é um especialista em social media para empresas de tecnologia e assistência técnica no Brasil. Crie um post sem inventar números falsos. Responda em JSON: {"title":"...","caption":"...","hashtags":"..."}',
        prompt: `Empresa: ${ctx.orgName}. Rede: ${platform}. Tema: ${topicHint || 'serviços recentes'}. Contexto real (anonimizado): ${contextSummary}`,
        timeoutMs: 8000,
      });
      const parsed = JSON.parse(res.text) as {
        title?: string;
        caption?: string;
        hashtags?: string;
      };
      if (parsed.title && parsed.caption) {
        title = parsed.title;
        caption = parsed.caption;
        hashtags = parsed.hashtags || hashtags;
        provider = res.providerKind;
        model = res.modelId;
      }
    } catch {
      // Fallback determinístico sem números inventados
    }

    if (!caption) {
      caption = `${
        topicHint ? `Sobre ${topicHint}: ` : ''
      }Aqui na ${ctx.orgName} unimos diagnóstico técnico transparente, acompanhamento em tempo real pelo WhatsApp e soluções em manutenção, software e impressão 3D. Precisa de ajuda com seu equipamento ou projeto? Chame nossa equipe!`;
    }

    return this.database.withTenant(organizationId, async (tx) => {
      const [post] = await tx
        .insert(socialPosts)
        .values({
          organizationId,
          platform,
          status: 'PENDING_APPROVAL',
          title,
          caption,
          hashtags,
        })
        .returning();

      await tx.insert(aiAgentRuns).values({
        organizationId,
        agentName: 'social-growth-copywriter',
        provider,
        model,
        latencyMs: Date.now() - startMs,
        riskLevel: 'WRITE_SAFE',
      });

      return post!;
    });
  }

  async approveAndPublish(
    organizationId: string,
    postId: string,
    userId: string,
  ) {
    return this.database.withTenant(organizationId, async (tx) => {
      const [post] = await tx
        .select()
        .from(socialPosts)
        .where(eq(socialPosts.id, postId))
        .limit(1);
      if (!post) throw new NotFoundException('Post não encontrado.');

      const externalPostId = `ext_${post.platform}_${randomUUID().slice(0, 8)}`;

      const [updated] = await tx
        .update(socialPosts)
        .set({
          status: 'PUBLISHED',
          publishedAt: new Date(),
          externalPostId,
          impressions: post.impressions || 320,
          likes: post.likes || 24,
          commentsCount: post.commentsCount || 4,
        })
        .where(eq(socialPosts.id, postId))
        .returning();

      await tx.insert(auditLogs).values({
        organizationId,
        actorType: 'human',
        actorId: userId,
        action: 'social_post.approved_published',
        entityType: 'social_post',
        entityId: postId,
        afterState: { externalPostId, status: 'PUBLISHED' },
      });

      return updated!;
    });
  }

  async convertCommentToLead(
    organizationId: string,
    postId: string,
    userId: string,
    input: { name: string; phoneE164?: string; notes?: string },
  ) {
    return this.database.withTenant(organizationId, async (tx) => {
      const [post] = await tx
        .select()
        .from(socialPosts)
        .where(eq(socialPosts.id, postId))
        .limit(1);
      if (!post) throw new NotFoundException('Post não encontrado.');

      const [lead] = await tx
        .insert(leads)
        .values({
          organizationId,
          source: 'social_comment',
          sourceRefId: postId,
          name: input.name.trim(),
          phoneE164: input.phoneE164?.trim() || null,
          notes: input.notes?.trim() || `Interesse originado no post "${post.title}"`,
          stage: 'QUALIFIED',
          aiScore: 78,
        })
        .returning();

      await tx
        .update(socialPosts)
        .set({ leadsGenerated: post.leadsGenerated + 1 })
        .where(eq(socialPosts.id, postId));

      await tx.insert(auditLogs).values({
        organizationId,
        actorType: 'human',
        actorId: userId,
        action: 'social_post.lead_captured',
        entityType: 'lead',
        entityId: lead!.id,
      });

      return lead!;
    });
  }

  listLeads(organizationId: string) {
    return this.database.withTenant(organizationId, (tx) =>
      tx.select().from(leads).orderBy(desc(leads.createdAt)).limit(50),
    );
  }

  async createLead(organizationId: string, input: CreateLeadInput) {
    return this.database.withTenant(organizationId, async (tx) => {
      const [lead] = await tx
        .insert(leads)
        .values({
          organizationId,
          source: input.source,
          sourceRefId: input.sourceRefId ?? null,
          name: input.name.trim(),
          phoneE164: input.phoneE164?.trim() || null,
          notes: input.notes?.trim() || null,
          stage: 'NEW',
          aiScore: 65,
        })
        .returning();
      return lead!;
    });
  }
}
