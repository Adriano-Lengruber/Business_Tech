import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  and,
  auditLogs,
  desc,
  eq,
  financialTransactions,
  organizations,
} from '@al/database';
import type { CreateTransactionInput } from '@al/shared';
import { DatabaseService } from '../database/database.module';
import { AsaasPaymentProvider } from './payment.provider';

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
    let payableCents = 0;

    for (const r of rows) {
      if (r.type === 'receivable') {
        if (r.status === 'CONFIRMED') {
          confirmedReceivableCents += r.amountCents;
        } else if (r.status === 'PENDING' || r.status === 'OVERDUE') {
          pendingReceivableCents += r.amountCents;
          if (r.status === 'OVERDUE' || r.dueDate.getTime() < now) {
            overdueReceivableCents += r.amountCents;
          }
        }
      } else if (r.type === 'payable' && r.status !== 'CANCELED') {
        payableCents += r.amountCents;
      }
    }

    return {
      confirmedReceivableCents,
      pendingReceivableCents,
      overdueReceivableCents,
      payableCents,
      netCashflowCents: confirmedReceivableCents - payableCents,
      totalTransactions: rows.length,
    };
  }

  async listTransactions(organizationId: string) {
    return this.database.withTenant(organizationId, (tx) =>
      tx
        .select()
        .from(financialTransactions)
        .orderBy(desc(financialTransactions.createdAt))
        .limit(100),
    );
  }

  async createTransaction(
    organizationId: string,
    userId: string,
    input: CreateTransactionInput & { quoteId?: string | null },
  ) {
    const dueDate = input.dueDate
      ? new Date(input.dueDate)
      : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    let charge:
      | {
          provider: string;
          chargeId: string;
          pixCopyPaste: string;
          invoiceUrl: string;
        }
      | null = null;

    if (input.type === 'receivable' && input.paymentMethod === 'pix') {
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
          status: 'PENDING',
          amountCents: input.amountCents,
          dueDate,
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
