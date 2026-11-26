import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  aiAgentRuns,
  auditLogs,
  desc,
  eq,
  fiscalDocuments,
  fiscalProfiles,
  organizations,
  quotes,
  sales,
  serviceOrders,
  sql,
} from '@al/database';
import { AiGateway, type AiPrivacyMode } from '@al/ai-core';
import type {
  EmitFiscalDocInput,
  UpsertFiscalProfileInput,
} from '@al/shared';
import { appEnv } from '../config/env';
import { DatabaseService } from '../database/database.module';
import { SandboxFiscalProvider } from './fiscal.provider';

@Injectable()
export class FiscalService {
  private readonly aiGateway = new AiGateway({
    localBaseUrl: appEnv.OLLAMA_BASE_URL,
    localChatModel: appEnv.OLLAMA_CHAT_MODEL,
    localReasoningModel: appEnv.OLLAMA_REASONING_MODEL,
  });

  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(SandboxFiscalProvider)
    private readonly fiscalProvider: SandboxFiscalProvider,
  ) {}

  async getProfile(organizationId: string) {
    return this.database.withTenant(organizationId, async (tx) => {
      const [profile] = await tx
        .select()
        .from(fiscalProfiles)
        .where(eq(fiscalProfiles.organizationId, organizationId))
        .limit(1);

      return (
        profile ?? {
          organizationId,
          taxRegime: 'SIMPLES_NACIONAL',
          stateUf: 'SP',
          cityCode: '3550308',
          nfeSeries: 1,
          nfceSeries: 1,
          nfseSeries: 1,
          providerName: 'sandbox',
        }
      );
    });
  }

  async upsertProfile(
    organizationId: string,
    userId: string,
    input: UpsertFiscalProfileInput,
  ) {
    return this.database.withTenant(organizationId, async (tx) => {
      const [existing] = await tx
        .select()
        .from(fiscalProfiles)
        .where(eq(fiscalProfiles.organizationId, organizationId))
        .limit(1);

      if (!existing) {
        const [created] = await tx
          .insert(fiscalProfiles)
          .values({
            organizationId,
            taxRegime: input.taxRegime,
            stateUf: input.stateUf.toUpperCase(),
            cityCode: input.cityCode,
            nfeSeries: input.nfeSeries,
            nfceSeries: input.nfceSeries,
            nfseSeries: input.nfseSeries,
            providerName: input.providerName,
          })
          .returning();
        return created!;
      }

      const [updated] = await tx
        .update(fiscalProfiles)
        .set({
          taxRegime: input.taxRegime,
          stateUf: input.stateUf.toUpperCase(),
          cityCode: input.cityCode,
          nfeSeries: input.nfeSeries,
          nfceSeries: input.nfceSeries,
          nfseSeries: input.nfseSeries,
          providerName: input.providerName,
          updatedAt: new Date(),
        })
        .where(eq(fiscalProfiles.id, existing.id))
        .returning();

      await tx.insert(auditLogs).values({
        organizationId,
        actorType: 'human',
        actorId: userId,
        action: 'fiscal.profile_updated',
        entityType: 'fiscal_profile',
        entityId: updated!.id,
        afterState: { taxRegime: updated!.taxRegime, stateUf: updated!.stateUf },
      });

      return updated!;
    });
  }

  async listDocuments(organizationId: string) {
    return this.database.withTenant(organizationId, (tx) =>
      tx
        .select()
        .from(fiscalDocuments)
        .orderBy(desc(fiscalDocuments.createdAt))
        .limit(50),
    );
  }

  async emit(
    organizationId: string,
    userId: string,
    input: EmitFiscalDocInput,
  ) {
    const profile = await this.getProfile(organizationId);

    const context = await this.database.withTenant(
      organizationId,
      async (tx) => {
        let totalCents = 0;
        if (input.referenceType === 'sale') {
          const [sale] = await tx
            .select()
            .from(sales)
            .where(eq(sales.id, input.referenceId))
            .limit(1);
          if (!sale) throw new NotFoundException('Venda não encontrada.');
          totalCents = sale.totalCents;
        } else {
          const [os] = await tx
            .select()
            .from(serviceOrders)
            .where(eq(serviceOrders.id, input.referenceId))
            .limit(1);
          if (!os) throw new NotFoundException('OS não encontrada.');
          const [approvedQuote] = await tx
            .select()
            .from(quotes)
            .where(eq(quotes.serviceOrderId, os.id))
            .orderBy(desc(quotes.createdAt))
            .limit(1);
          totalCents = approvedQuote?.totalCents ?? 0;
        }

        const countRes = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(fiscalDocuments);
        const nextNumber = (countRes[0]?.count ?? 0) + 1;
        return { totalCents, nextNumber };
      },
    );

    const series =
      input.docType === 'NFE'
        ? profile.nfeSeries
        : input.docType === 'NFCE'
          ? profile.nfceSeries
          : profile.nfseSeries;

    const result = await this.fiscalProvider.issue({
      docType: input.docType,
      series,
      number: context.nextNumber,
      totalCents: context.totalCents,
      stateUf: profile.stateUf,
      taxRegime: profile.taxRegime,
      providerName: profile.providerName,
      simulateRejection: input.simulateRejection,
    });

    return this.database.withTenant(organizationId, async (tx) => {
      const [doc] = await tx
        .insert(fiscalDocuments)
        .values({
          organizationId,
          docType: input.docType,
          status: result.status,
          number: context.nextNumber,
          series,
          accessKey: result.accessKey,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          totalCents: context.totalCents,
          providerName: profile.providerName,
          rejectionReason: result.rejectionReason,
          xmlUrl: result.xmlUrl,
          pdfUrl: result.pdfUrl,
          issuedAt: result.issuedAt,
        })
        .returning();

      await tx.insert(auditLogs).values({
        organizationId,
        actorType: 'human',
        actorId: userId,
        action: 'fiscal.document_emitted',
        entityType: 'fiscal_document',
        entityId: doc!.id,
        afterState: {
          docType: doc!.docType,
          status: doc!.status,
          number: doc!.number,
        },
      });

      return doc!;
    });
  }

  async diagnoseRejection(organizationId: string, docId: string) {
    const startMs = Date.now();
    const ctx = await this.database.withTenant(organizationId, async (tx) => {
      const [doc] = await tx
        .select()
        .from(fiscalDocuments)
        .where(eq(fiscalDocuments.id, docId))
        .limit(1);
      if (!doc) throw new NotFoundException('Documento fiscal não encontrado.');

      const [org] = await tx
        .select({ privacyMode: organizations.aiPrivacyMode })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);

      return { doc, privacyMode: (org?.privacyMode ?? 'strict_local') as AiPrivacyMode };
    });

    const reason = ctx.doc.rejectionReason ?? 'Sem rejeição registrada.';
    let hint = '';
    let provider = 'grounded-fallback';
    let model = 'deterministic-fiscal-guard';

    try {
      const aiRes = await this.aiGateway.generateGroundedReply({
        task: 'triage',
        privacyMode: ctx.privacyMode,
        system:
          'Você é um especialista fiscal brasileiro (SEFAZ). Explique a causa da rejeição e liste 2 passos objetivos para corrigir o cadastro do produto/cliente antes de reemitir.',
        prompt: `Tipo: ${ctx.doc.docType}. Erro SEFAZ: ${reason}`,
        timeoutMs: 8000,
      });
      if (aiRes.text) {
        hint = aiRes.text;
        provider = aiRes.providerKind;
        model = aiRes.modelId;
      }
    } catch {
      // Fallback determinístico quando Ollama local não está ativo
    }

    if (!hint) {
      hint = reason.includes('NCM')
        ? 'Causa provável: NCM com 8 dígitos incorreto ou CSOSN/CFOP incompatível com Simples Nacional. Ação recomendada: revise o campo NCM e CFOP (ex: 5102 para venda interna) no cadastro do produto em Estoque e tente emitir novamente.'
        : `Erro reportado pela SEFAZ: ${reason}. Revise o regime tributário do perfil fiscal e os dados do destinatário antes de reemitir.`;
    }

    return this.database.withTenant(organizationId, async (tx) => {
      const [updated] = await tx
        .update(fiscalDocuments)
        .set({ aiDiagnosticHint: hint })
        .where(eq(fiscalDocuments.id, docId))
        .returning();

      await tx.insert(aiAgentRuns).values({
        organizationId,
        agentName: 'fiscal-rejection-analyst',
        provider,
        model,
        latencyMs: Date.now() - startMs,
        riskLevel: 'READ_ONLY',
      });

      return updated!;
    });
  }
}
