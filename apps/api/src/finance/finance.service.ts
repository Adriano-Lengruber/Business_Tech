import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  and,
  auditLogs,
  desc,
  eq,
  financialTransactions,
  ilike,
  or,
  organizations,
} from '@al/database';
import type { CreateTransactionInput, UpdateTransactionInput } from '@al/shared';
import { DatabaseService } from '../database/database.module';
import { AsaasPaymentProvider } from './payment.provider';

function parseFlexibleDate(raw?: string): Date {
  if (!raw?.trim()) return new Date();
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T12:00:00.000Z`);
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

@Injectable()
export class FinanceService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(AsaasPaymentProvider)
    private readonly paymentProvider: AsaasPaymentProvider,
  ) {}

  async getSummary(organizationId: string) {
    const rows = await this.database.withTenant(organizationId, (tx) =>
      tx.select().from(financialTransactions),
    );

    const now = Date.now();
    let confirmedReceivableCents = 0;
    let pendingReceivableCents = 0;
    let overdueReceivableCents = 0;
    let confirmedPayableCents = 0;
    let pendingPayableCents = 0;
    const categoryTotals = new Map<
      string,
      { category: string; receivableCents: number; payableCents: number }
    >();

    for (const r of rows) {
      if (r.status === 'CANCELED') continue;

      const catEntry = categoryTotals.get(r.category) ?? {
        category: r.category,
        receivableCents: 0,
        payableCents: 0,
      };

      const isConfirmed = r.status === 'CONFIRMED' || r.status === 'PAID';
      if (r.type === 'receivable' || r.type === 'pos_sale') {
        catEntry.receivableCents += r.amountCents;
        if (isConfirmed) {
          confirmedReceivableCents += r.amountCents;
        } else {
          pendingReceivableCents += r.amountCents;
          if (r.status === 'OVERDUE' || r.dueDate.getTime() < now) {
            overdueReceivableCents += r.amountCents;
          }
        }
      } else if (r.type === 'payable') {
        catEntry.payableCents += r.amountCents;
        if (isConfirmed) {
          confirmedPayableCents += r.amountCents;
        } else {
          pendingPayableCents += r.amountCents;
        }
      }
      categoryTotals.set(r.category, catEntry);
    }

    const payableCents = confirmedPayableCents + pendingPayableCents;
    return {
      confirmedReceivableCents,
      pendingReceivableCents,
      overdueReceivableCents,
      confirmedPayableCents,
      pendingPayableCents,
      payableCents,
      netCashflowCents: confirmedReceivableCents - payableCents,
      realizedCashflowCents: confirmedReceivableCents - confirmedPayableCents,
      projectedCashflowCents:
        confirmedReceivableCents + pendingReceivableCents - payableCents,
      categoryBreakdown: Array.from(categoryTotals.values()).sort(
        (a, b) =>
          b.receivableCents + b.payableCents - (a.receivableCents + a.payableCents),
      ),
      totalTransactions: rows.length,
    };
  }

  async listTransactions(
    organizationId: string,
    filters?: { type?: string; status?: string; q?: string },
  ) {
    return this.database.withTenant(organizationId, (tx) => {
      const conditions = [];
      if (filters?.type && filters.type !== 'all') {
        conditions.push(eq(financialTransactions.type, filters.type));
      }
      if (filters?.status && filters.status !== 'all') {
        conditions.push(eq(financialTransactions.status, filters.status));
      }
      if (filters?.q?.trim()) {
        const term = `%${filters.q.trim()}%`;
        conditions.push(
          or(
            ilike(financialTransactions.description, term),
            ilike(financialTransactions.category, term),
          ),
        );
      }

      return tx
        .select()
        .from(financialTransactions)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(financialTransactions.createdAt))
        .limit(150);
    });
  }

  async createTransaction(
    organizationId: string,
    userId: string,
    input: Partial<CreateTransactionInput> & {
      type: CreateTransactionInput['type'];
      category: string;
      description: string;
      paymentMethod: CreateTransactionInput['paymentMethod'];
      amountCents: number;
      quoteId?: string | null;
    },
  ) {
    const dueDate = input.dueDate
      ? parseFlexibleDate(input.dueDate)
      : input.paidImmediately
        ? new Date()
        : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    const paidImmediately = Boolean(input.paidImmediately);

    let charge:
      | {
          provider: string;
          chargeId: string;
          pixCopyPaste: string;
          invoiceUrl: string;
        }
      | null = null;

    if (
      !paidImmediately &&
      input.type === 'receivable' &&
      input.paymentMethod === 'pix'
    ) {
      charge = await this.paymentProvider.createPixCharge({
        amountCents: input.amountCents,
        description: input.description,
        dueDate,
        externalReference: input.quoteId ?? input.serviceOrderId ?? organizationId,
      });
    }

    return this.database.withTenant(organizationId, async (tx) => {
      const [created] = await tx
        .insert(financialTransactions)
        .values({
          organizationId,
          serviceOrderId: input.serviceOrderId ?? null,
          quoteId: input.quoteId ?? null,
          type: input.type,
          category: input.category,
          description: input.description,
          paymentMethod: input.paymentMethod,
          status: paidImmediately ? 'CONFIRMED' : 'PENDING',
          amountCents: input.amountCents,
          dueDate,
          paidAt: paidImmediately ? dueDate : null,
          gatewayProvider: charge?.provider ?? null,
          gatewayChargeId: charge?.chargeId ?? null,
          pixCopyPaste: charge?.pixCopyPaste ?? null,
          invoiceUrl: charge?.invoiceUrl ?? null,
        })
        .returning();

      await tx.insert(auditLogs).values({
        organizationId,
        actorType: userId === 'portal-customer' ? 'automation' : 'human',
        actorId: userId,
        action: 'finance.transaction_created',
        entityType: 'financial_transaction',
        entityId: created!.id,
        afterState: {
          type: created!.type,
          amountCents: created!.amountCents,
          status: created!.status,
        },
      });

      return created!;
    });
  }

  async updateTransaction(
    organizationId: string,
    transactionId: string,
    actorId: string,
    input: UpdateTransactionInput,
  ) {
    return this.database.withTenant(organizationId, async (tx) => {
      const [existing] = await tx
        .select()
        .from(financialTransactions)
        .where(eq(financialTransactions.id, transactionId))
        .limit(1);

      if (!existing) {
        throw new NotFoundException('Lançamento financeiro não encontrado.');
      }

      const nextStatus = input.status ?? existing.status;
      const [updated] = await tx
        .update(financialTransactions)
        .set({
          category: input.category?.trim() ?? existing.category,
          description: input.description?.trim() ?? existing.description,
          paymentMethod: input.paymentMethod ?? existing.paymentMethod,
          amountCents: input.amountCents ?? existing.amountCents,
          dueDate: input.dueDate ? parseFlexibleDate(input.dueDate) : existing.dueDate,
          status: nextStatus,
          paidAt:
            nextStatus === 'CONFIRMED'
              ? existing.paidAt ?? new Date()
              : nextStatus === 'PENDING'
                ? null
                : existing.paidAt,
          updatedAt: new Date(),
        })
        .where(eq(financialTransactions.id, transactionId))
        .returning();

      await tx.insert(auditLogs).values({
        organizationId,
        actorType: 'human',
        actorId,
        action: 'finance.transaction_updated',
        entityType: 'financial_transaction',
        entityId: transactionId,
        beforeState: { status: existing.status, amountCents: existing.amountCents },
        afterState: { status: updated!.status, amountCents: updated!.amountCents },
      });

      return updated!;
    });
  }

  async cancelTransaction(
    organizationId: string,
    transactionId: string,
    actorId: string,
  ) {
    return this.updateTransaction(organizationId, transactionId, actorId, {
      status: 'CANCELED',
    });
  }

  async confirmTransaction(
    organizationId: string,
    transactionId: string,
    actorId: string,
    actorType: 'human' | 'automation' = 'human',
  ) {
    return this.database.withTenant(organizationId, async (tx) => {
      const existing = await tx
        .select()
        .from(financialTransactions)
        .where(eq(financialTransactions.id, transactionId))
        .limit(1);

      if (!existing[0]) {
        throw new NotFoundException('Lançamento financeiro não encontrado.');
      }
      if (existing[0].status === 'CONFIRMED') {
        return existing[0];
      }

      const [updated] = await tx
        .update(financialTransactions)
        .set({
          status: 'CONFIRMED',
          paidAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(financialTransactions.id, transactionId))
        .returning();

      await tx.insert(auditLogs).values({
        organizationId,
        actorType,
        actorId,
        action: 'finance.transaction_confirmed',
        entityType: 'financial_transaction',
        entityId: transactionId,
        beforeState: { status: existing[0].status },
        afterState: { status: 'CONFIRMED' },
      });

      return updated!;
    });
  }

  async handleAsaasWebhook(
    orgSlug: string,
    event: string,
    chargeId: string,
  ) {
    const [org] = await this.database.db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, orgSlug))
      .limit(1);

    if (!org) {
      throw new NotFoundException('Organização não encontrada.');
    }

    if (event !== 'PAYMENT_RECEIVED' && event !== 'PAYMENT_CONFIRMED') {
      return { ignored: true, event };
    }

    return this.database.withTenant(org.id, async (tx) => {
      const [row] = await tx
        .select()
        .from(financialTransactions)
        .where(
          and(
            eq(financialTransactions.organizationId, org.id),
            eq(financialTransactions.gatewayChargeId, chargeId),
          ),
        )
        .limit(1);

      if (!row) {
        return { matched: false, chargeId };
      }

      if (row.status === 'CONFIRMED') {
        return { matched: true, idempotent: true, transactionId: row.id };
      }

      await tx
        .update(financialTransactions)
        .set({
          status: 'CONFIRMED',
          paidAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(financialTransactions.id, row.id));

      await tx.insert(auditLogs).values({
        organizationId: org.id,
        actorType: 'automation',
        actorId: 'asaas-webhook',
        action: 'finance.webhook_confirmed',
        entityType: 'financial_transaction',
        entityId: row.id,
        beforeState: { status: row.status },
        afterState: { status: 'CONFIRMED', chargeId },
      });

      return { matched: true, confirmed: true, transactionId: row.id };
    });
  }
}
