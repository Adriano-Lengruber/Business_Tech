import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  aiAgentRuns,
  auditLogs,
  desc,
  eq,
  organizations,
  sourcingOffers,
  sourcingRequests,
  sql,
} from '@al/database';
import { AiGateway, type AiPrivacyMode } from '@al/ai-core';
import type {
  AddSourcingOfferInput,
  CreateSourcingRequestInput,
} from '@al/shared';
import { appEnv } from '../config/env';
import { DatabaseService } from '../database/database.module';

@Injectable()
export class SourcingService {
  private readonly aiGateway = new AiGateway({
    localBaseUrl: appEnv.OLLAMA_BASE_URL,
    localChatModel: appEnv.OLLAMA_CHAT_MODEL,
    localReasoningModel: appEnv.OLLAMA_REASONING_MODEL,
  });

  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async listRequests(organizationId: string) {
    return this.database.withTenant(organizationId, async (tx) => {
      const requests = await tx
        .select()
        .from(sourcingRequests)
        .orderBy(desc(sourcingRequests.createdAt));

      const offers = await tx
        .select()
        .from(sourcingOffers)
        .orderBy(sourcingOffers.landedUnitCostCents);

      return requests.map((req) => {
        const reqOffers = offers
          .filter((o) => o.requestId === req.id)
          .sort((a, b) => a.landedUnitCostCents - b.landedUnitCostCents);

        const bestOverall = reqOffers[0] ?? null;
        const bestB2b =
          reqOffers.find((o) => o.channelType === 'supplier_b2b') ?? null;
        const bestMarketplace =
          reqOffers.find((o) => o.channelType === 'marketplace_pf') ?? null;

        let cheaperChannel: 'supplier_b2b' | 'marketplace_pf' | 'tie' | null =
          null;
        let savingsCents = 0;

        if (bestB2b && bestMarketplace) {
          if (
            bestMarketplace.landedUnitCostCents < bestB2b.landedUnitCostCents
          ) {
            cheaperChannel = 'marketplace_pf';
            savingsCents =
              bestB2b.landedUnitCostCents - bestMarketplace.landedUnitCostCents;
          } else if (
            bestB2b.landedUnitCostCents < bestMarketplace.landedUnitCostCents
          ) {
            cheaperChannel = 'supplier_b2b';
            savingsCents =
              bestMarketplace.landedUnitCostCents - bestB2b.landedUnitCostCents;
          } else {
            cheaperChannel = 'tie';
          }
        }

        return {
          ...req,
          offers: reqOffers,
          comparison: {
            bestOverall,
            bestB2b,
            bestMarketplace,
            cheaperChannel,
            savingsCents,
          },
        };
      });
    });
  }

  async createRequest(
    organizationId: string,
    userId: string,
    input: CreateSourcingRequestInput,
  ) {
    return this.database.withTenant(organizationId, async (tx) => {
      const countRes = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(sourcingRequests);
      const nextNum = (countRes[0]?.count ?? 0) + 1;
      const code = `COT-${new Date().getFullYear()}-${String(nextNum).padStart(4, '0')}`;

      const [created] = await tx
        .insert(sourcingRequests)
        .values({
          organizationId,
          code,
          itemName: input.itemName.trim(),
          category: input.category,
          desiredQty: input.desiredQty,
          targetResalePriceCents: input.targetResalePriceCents ?? null,
          urgency: input.urgency,
          status: 'OPEN',
        })
        .returning();

      await tx.insert(auditLogs).values({
        organizationId,
        actorType: 'human',
        actorId: userId,
        action: 'sourcing.request_created',
        entityType: 'sourcing_request',
        entityId: created!.id,
        afterState: { code, itemName: created!.itemName },
      });

      return created!;
    });
  }

  async addOffer(
    organizationId: string,
    requestId: string,
    input: AddSourcingOfferInput,
  ) {
    return this.database.withTenant(organizationId, async (tx) => {
      const [req] = await tx
        .select()
        .from(sourcingRequests)
        .where(eq(sourcingRequests.id, requestId))
        .limit(1);

      if (!req) {
        throw new NotFoundException('Solicitação de cotação não encontrada.');
      }

      const qty = Math.max(1, req.desiredQty);
      const landedUnitCostCents =
        input.unitPriceCents +
        Math.round((input.shippingCents + input.taxOrFeeCents) / qty);

      const [offer] = await tx
        .insert(sourcingOffers)
        .values({
          organizationId,
          requestId,
          supplierId: input.supplierId ?? null,
          channelType: input.channelType,
          vendorName: input.vendorName.trim(),
          unitPriceCents: input.unitPriceCents,
          shippingCents: input.shippingCents,
          taxOrFeeCents: input.taxOrFeeCents,
          landedUnitCostCents,
          deliveryDays: input.deliveryDays,
          paymentTerms: input.paymentTerms?.trim() || null,
          sourceUrl: input.sourceUrl?.trim() || null,
          notes: input.notes?.trim() || null,
        })
        .returning();

      return offer!;
    });
  }

  async recommendWithAi(organizationId: string, requestId: string) {
    const startMs = Date.now();
    const { req, offers, privacyMode } = await this.database.withTenant(
      organizationId,
      async (tx) => {
        const [org] = await tx
          .select({ aiPrivacyMode: organizations.aiPrivacyMode })
          .from(organizations)
          .where(eq(organizations.id, organizationId))
          .limit(1);

        const [foundReq] = await tx
          .select()
          .from(sourcingRequests)
          .where(eq(sourcingRequests.id, requestId))
          .limit(1);

        if (!foundReq) {
          throw new NotFoundException('Cotação não encontrada.');
        }

        const reqOffers = await tx
          .select()
          .from(sourcingOffers)
          .where(eq(sourcingOffers.requestId, requestId))
          .orderBy(sourcingOffers.landedUnitCostCents);

        return {
          req: foundReq,
          offers: reqOffers,
          privacyMode: (org?.aiPrivacyMode ?? 'strict_local') as AiPrivacyMode,
        };
      },
    );

    if (offers.length === 0) {
      return {
        recommendation:
          'Adicione pelo menos 2 cotações (ex: um Distribuidor B2B e um Marketplace PF) para comparar custo posto e prazo.',
      };
    }

    const best = offers[0]!;
    const bestB2b = offers.find((o) => o.channelType === 'supplier_b2b');
    const bestMkt = offers.find((o) => o.channelType === 'marketplace_pf');

    const formatBrl = (c: number) =>
      (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    let recommendation = `Melhor custo efetivo posto na loja: ${best.vendorName} (${best.channelType === 'marketplace_pf' ? 'Marketplace PF' : 'Distribuidor B2B'}) a ${formatBrl(best.landedUnitCostCents)}/un com entrega em ${best.deliveryDays} dia(s).`;

    if (bestB2b && bestMkt) {
      const diff = Math.abs(
        bestB2b.landedUnitCostCents - bestMkt.landedUnitCostCents,
      );
      if (bestMkt.landedUnitCostCents < bestB2b.landedUnitCostCents) {
        recommendation += ` Atenção: comprar no Marketplace PF (${bestMkt.vendorName}) está ${formatBrl(diff)}/un mais barato que no distribuidor B2B (${bestB2b.vendorName}), mesmo considerando frete.`;
      } else if (bestB2b.landedUnitCostCents < bestMkt.landedUnitCostCents) {
        recommendation += ` O distribuidor B2B (${bestB2b.vendorName}) vence o Marketplace PF com economia de ${formatBrl(diff)}/un e possibilidade de NF-e de entrada para revenda.`;
      }
    }

    if (req.targetResalePriceCents) {
      const marginCents = req.targetResalePriceCents - best.landedUnitCostCents;
      const marginPct = Math.round(
        (marginCents / Math.max(1, req.targetResalePriceCents)) * 100,
      );
      recommendation += ` Na revenda alvo de ${formatBrl(req.targetResalePriceCents)}, a margem bruta estimada é de ${formatBrl(marginCents)} (${marginPct}%).`;
    }

    let provider = 'grounded-sourcing';
    let model = 'deterministic-landed-cost';

    try {
      const aiRes = await this.aiGateway.generateGroundedReply({
        task: 'triage',
        privacyMode,
        system:
          'Você é o Analista de Compras de uma loja/assistência de informática no Brasil. Compare B2B vs Marketplace PF usando APENAS os valores informados, destaque economia em R$, prazo e margem. Máximo 3 frases.',
        prompt: JSON.stringify({
          item: req.itemName,
          qty: req.desiredQty,
          urgency: req.urgency,
          targetResalePriceCents: req.targetResalePriceCents,
          offers: offers.map((o) => ({
            vendor: o.vendorName,
            channel: o.channelType,
            landedUnitCostCents: o.landedUnitCostCents,
            deliveryDays: o.deliveryDays,
            paymentTerms: o.paymentTerms,
          })),
        }),
        timeoutMs: 1800,
      });
      if (aiRes.text) {
        recommendation = aiRes.text;
        provider = aiRes.providerKind;
        model = aiRes.modelId;
      }
    } catch {
      // fallback determinístico preciso
    }

    await this.database.withTenant(organizationId, async (tx) => {
      await tx
        .update(sourcingRequests)
        .set({ aiRecommendation: recommendation, updatedAt: new Date() })
        .where(eq(sourcingRequests.id, requestId));

      await tx.insert(aiAgentRuns).values({
        organizationId,
        agentName: 'sourcing-price-analyst',
        provider,
        model,
        latencyMs: Date.now() - startMs,
        riskLevel: 'READ_ONLY',
      });
    });

    return { recommendation, bestOffer: best };
  }

  async selectOffer(
    organizationId: string,
    requestId: string,
    offerId: string,
    userId: string,
  ) {
    return this.database.withTenant(organizationId, async (tx) => {
      const [updated] = await tx
        .update(sourcingRequests)
        .set({
          selectedOfferId: offerId,
          status: 'DECIDED',
          updatedAt: new Date(),
        })
        .where(eq(sourcingRequests.id, requestId))
        .returning();

      if (!updated) {
        throw new NotFoundException('Cotação não encontrada.');
      }

      await tx.insert(auditLogs).values({
        organizationId,
        actorType: 'human',
        actorId: userId,
        action: 'sourcing.offer_selected',
        entityType: 'sourcing_request',
        entityId: requestId,
        afterState: { selectedOfferId: offerId },
      });

      return updated;
    });
  }
}
