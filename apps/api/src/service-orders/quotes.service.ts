import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  and,
  auditLogs,
  desc,
  eq,
  inArray,
  quoteItems,
  quotes,
  serviceOrderEvents,
  serviceOrders,
  sql,
} from '@al/database';
import {
  calculateQuoteTotals,
  type CreateQuoteInput,
  type PortalQuoteDecisionInput,
} from '@al/shared';
import { DatabaseService } from '../database/database.module';
import { FinanceService } from '../finance/finance.service';

@Injectable()
export class QuotesService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(FinanceService) private readonly financeService: FinanceService,
  ) {}

  async listForOrder(organizationId: string, serviceOrderId: string) {
    return this.database.withTenant(organizationId, async (tx) => {
      const quoteRows = await tx
        .select()
        .from(quotes)
        .where(eq(quotes.serviceOrderId, serviceOrderId))
        .orderBy(desc(quotes.createdAt));

      if (quoteRows.length === 0) return [];

      const items = await tx
        .select()
        .from(quoteItems)
        .where(
          inArray(
            quoteItems.quoteId,
            quoteRows.map((q) => q.id),
          ),
        );

      return quoteRows.map((q) => ({
        ...q,
        items: items.filter((i) => i.quoteId === q.id),
      }));
    });
  }

  async create(
    organizationId: string,
    serviceOrderId: string,
    userId: string,
    input: CreateQuoteInput,
  ) {
    const totals = calculateQuoteTotals(input.items);
    const validUntil = new Date(
      Date.now() + input.validDays * 24 * 60 * 60 * 1000,
    );
    const initialStatus = input.sendImmediately ? 'SENT' : 'DRAFT';

    return this.database.withTenant(organizationId, async (tx) => {
      const [os] = await tx
        .select()
        .from(serviceOrders)
        .where(eq(serviceOrders.id, serviceOrderId))
        .limit(1);

      if (!os) {
        throw new NotFoundException('Ordem de serviço não encontrada.');
      }

      const countRes = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(quotes);
      const nextNum = (countRes[0]?.count ?? 0) + 1;
      const code = `ORC-${new Date().getFullYear()}-${String(nextNum).padStart(4, '0')}`;

      const [quote] = await tx
        .insert(quotes)
        .values({
          organizationId,
          serviceOrderId,
          code,
          tier: input.tier,
          status: initialStatus,
          warrantyDays: input.warrantyDays,
          validUntil,
          paymentTerms: input.paymentTerms,
          clientNotes: input.clientNotes?.trim() || null,
          subtotalCents: totals.subtotalCents,
          discountCents: totals.discountCents,
          totalCents: totals.totalCents,
          estimatedCostCents: totals.estimatedCostCents,
        })
        .returning();

      const insertedItems = await tx
        .insert(quoteItems)
        .values(
          input.items.map((item) => ({
            organizationId,
            quoteId: quote!.id,
            itemType: item.itemType,
            description: item.description.trim(),
            quantity: Math.round(item.quantity),
            unitCostCents: item.unitCostCents,
            unitPriceCents: item.unitPriceCents,
            totalPriceCents: Math.round(item.quantity * item.unitPriceCents),
          })),
        )
        .returning();

      if (input.sendImmediately) {
        await tx
          .update(serviceOrders)
          .set({ status: 'AWAITING_APPROVAL', updatedAt: new Date() })
          .where(eq(serviceOrders.id, serviceOrderId));

        await tx.insert(serviceOrderEvents).values({
          organizationId,
          serviceOrderId,
          eventType: 'quote.sent',
          fromStatus: os.status,
          toStatus: 'AWAITING_APPROVAL',
          note: `Orçamento ${code} enviado para aprovação do cliente.`,
          actorType: 'human',
          actorId: userId,
        });
      }

      await tx.insert(auditLogs).values({
        organizationId,
        actorType: 'human',
        actorId: userId,
        action: 'quote.created',
        entityType: 'quote',
        entityId: quote!.id,
        afterState: {
          code,
          tier: input.tier,
          totalCents: totals.totalCents,
          status: initialStatus,
        },
      });

      return { ...quote!, items: insertedItems, totals };
    });
  }

  async sendQuote(organizationId: string, quoteId: string, userId: string) {
    return this.database.withTenant(organizationId, async (tx) => {
      const [quote] = await tx
        .select()
        .from(quotes)
        .where(eq(quotes.id, quoteId))
        .limit(1);

      if (!quote) {
        throw new NotFoundException('Orçamento não encontrado.');
      }

      const [updated] = await tx
        .update(quotes)
        .set({ status: 'SENT', updatedAt: new Date() })
        .where(eq(quotes.id, quoteId))
        .returning();

      await tx
        .update(serviceOrders)
        .set({ status: 'AWAITING_APPROVAL', updatedAt: new Date() })
        .where(eq(serviceOrders.id, quote.serviceOrderId));

      await tx.insert(serviceOrderEvents).values({
        organizationId,
        serviceOrderId: quote.serviceOrderId,
        eventType: 'quote.sent',
        toStatus: 'AWAITING_APPROVAL',
        note: `Orçamento ${quote.code} liberado no Portal do Cliente.`,
        actorType: 'human',
        actorId: userId,
      });

      return updated!;
    });
  }

  async decideFromPortal(params: {
    osCode: string;
    token: string;
    quoteId: string;
    input: PortalQuoteDecisionInput;
    clientIp: string;
    userAgent: string;
  }) {
    if (!params.token) {
      throw new UnauthorizedException('Token do portal obrigatório.');
    }
    const tokenHash = createHash('sha256').update(params.token).digest('hex');

    const [osMatch] = await this.database.db
      .select({
        id: serviceOrders.id,
        organizationId: serviceOrders.organizationId,
        code: serviceOrders.code,
        status: serviceOrders.status,
      })
      .from(serviceOrders)
      .where(
        and(
          eq(serviceOrders.code, params.osCode),
          eq(serviceOrders.portalTokenHash, tokenHash),
        ),
      )
      .limit(1);

    if (!osMatch) {
      throw new UnauthorizedException('Link do portal inválido ou expirado.');
    }

    const acceptedAt = new Date();
    const result = await this.database.withTenant(
      osMatch.organizationId,
      async (tx) => {
        const [quote] = await tx
          .select()
          .from(quotes)
          .where(
            and(
              eq(quotes.id, params.quoteId),
              eq(quotes.serviceOrderId, osMatch.id),
            ),
          )
          .limit(1);

        if (!quote) {
          throw new NotFoundException('Orçamento não encontrado para esta OS.');
        }

        if (quote.status === 'APPROVED' || quote.status === 'REJECTED') {
          throw new BadRequestException(
            `Orçamento já finalizado com status ${quote.status}.`,
          );
        }

        const acceptanceHash = createHash('sha256')
          .update(
            `${quote.id}|${osMatch.code}|${quote.totalCents}|${params.input.decision}|${params.clientIp}|${acceptedAt.toISOString()}`,
          )
          .digest('hex');

        const [updatedQuote] = await tx
          .update(quotes)
          .set({
            status: params.input.decision,
            acceptedAt,
            acceptedIp: params.clientIp,
            acceptedUserAgent: params.userAgent,
            acceptanceHash,
            updatedAt: acceptedAt,
          })
          .where(eq(quotes.id, quote.id))
          .returning();

        const nextOsStatus =
          params.input.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';

        await tx
          .update(serviceOrders)
          .set({ status: nextOsStatus, updatedAt: acceptedAt })
          .where(eq(serviceOrders.id, osMatch.id));

        await tx.insert(serviceOrderEvents).values({
          organizationId: osMatch.organizationId,
          serviceOrderId: osMatch.id,
          eventType:
            params.input.decision === 'APPROVED'
              ? 'quote.approved'
              : 'quote.rejected',
          fromStatus: osMatch.status,
          toStatus: nextOsStatus,
          note:
            params.input.customerNote?.trim() ||
            `Cliente ${params.input.decision === 'APPROVED' ? 'aprovou' : 'recusou'} ${quote.code} digitalmente (hash ${acceptanceHash.slice(0, 12)}).`,
          actorType: 'human',
          actorId: 'portal-customer',
        });

        await tx.insert(auditLogs).values({
          organizationId: osMatch.organizationId,
          actorType: 'human',
          actorId: 'portal-customer',
          action:
            params.input.decision === 'APPROVED'
              ? 'quote.approved_portal'
              : 'quote.rejected_portal',
          entityType: 'quote',
          entityId: quote.id,
          afterState: {
            decision: params.input.decision,
            acceptanceHash,
            ip: params.clientIp,
          },
        });

        return { quote: updatedQuote!, osId: osMatch.id, osCode: osMatch.code };
      },
    );

    let transaction = null;
    if (params.input.decision === 'APPROVED' && result.quote.totalCents > 0) {
      transaction = await this.financeService.createTransaction(
        osMatch.organizationId,
        'portal-customer',
        {
          type: 'receivable',
          category: 'Ordem de Serviço',
          description: `Aprovação ${result.quote.code} — ${result.osCode}`,
          paymentMethod: params.input.paymentMethod,
          amountCents: result.quote.totalCents,
          serviceOrderId: result.osId,
          quoteId: result.quote.id,
        },
      );
    }

    return {
      quote: result.quote,
      transaction,
    };
  }
}
