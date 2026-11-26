import { Inject, Injectable } from '@nestjs/common';
import {
  customers,
  financialTransactions,
  products,
  quotes,
  serviceOrders,
} from '@al/database';
import { checkStockAlert } from '@al/shared';
import { DatabaseService } from '../database/database.module';

export interface StageCountPoint {
  key: string;
  label: string;
  count: number;
  tone: 'neutral' | 'info' | 'warning' | 'accent' | 'success' | 'danger';
}

export interface DailyCashflowPoint {
  dateKey: string;
  label: string;
  incomeCents: number;
  expenseCents: number;
  netCents: number;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async getOverview(organizationId: string) {
    return this.database.withTenant(organizationId, async (tx) => {
      const [osRows, txRows, quoteRows, prodRows, custRows] = await Promise.all([
        tx
          .select({
            id: serviceOrders.id,
            status: serviceOrders.status,
            priority: serviceOrders.priority,
            createdAt: serviceOrders.createdAt,
            updatedAt: serviceOrders.updatedAt,
            closedAt: serviceOrders.closedAt,
          })
          .from(serviceOrders),
        tx
          .select({
            type: financialTransactions.type,
            status: financialTransactions.status,
            amountCents: financialTransactions.amountCents,
            dueDate: financialTransactions.dueDate,
            paidAt: financialTransactions.paidAt,
            createdAt: financialTransactions.createdAt,
          })
          .from(financialTransactions),
        tx
          .select({
            status: quotes.status,
            totalCents: quotes.totalCents,
          })
          .from(quotes),
        tx
          .select({
            stockQty: products.stockQty,
            minStockQty: products.minStockQty,
          })
          .from(products),
        tx.select({ id: customers.id }).from(customers),
      ]);

      // 1. OS Pipeline Distribution (grouped by operational stage)
      const stageBuckets: Array<{
        key: string;
        label: string;
        statuses: readonly string[];
        tone: StageCountPoint['tone'];
      }> = [
        {
          key: 'intake',
          label: 'Triagem / Entrada',
          statuses: ['PRE_REGISTRATION', 'AWAITING_RECEIPT', 'RECEIVED', 'TRIAGE'],
          tone: 'neutral',
        },
        {
          key: 'diagnosis',
          label: 'Diagnóstico',
          statuses: ['DIAGNOSIS'],
          tone: 'info',
        },
        {
          key: 'approval',
          label: 'Orçamento',
          statuses: ['AWAITING_QUOTE', 'QUOTE_SENT', 'AWAITING_APPROVAL', 'APPROVED'],
          tone: 'warning',
        },
        {
          key: 'bench',
          label: 'Bancada / Peças',
          statuses: ['AWAITING_PART', 'IN_REPAIR', 'AWAITING_TEST', 'TESTING'],
          tone: 'accent',
        },
        {
          key: 'ready',
          label: 'Pronto / Retirada',
          statuses: ['READY', 'AWAITING_PICKUP'],
          tone: 'success',
        },
        {
          key: 'warranty',
          label: 'Garantia / Pós',
          statuses: ['WARRANTY', 'POST_SERVICE'],
          tone: 'danger',
        },
      ];

      const osByStage: StageCountPoint[] = stageBuckets.map((b) => ({
        key: b.key,
        label: b.label,
        count: osRows.filter((o) => b.statuses.includes(o.status)).length,
        tone: b.tone,
      }));

      // 2. Last 7 days cashflow chart
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dailyMap = new Map<string, DailyCashflowPoint>();
      for (let offset = 6; offset >= 0; offset--) {
        const d = new Date(today);
        d.setDate(today.getDate() - offset);
        const key = d.toISOString().slice(0, 10);
        const label = d.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
        });
        dailyMap.set(key, {
          dateKey: key,
          label,
          incomeCents: 0,
          expenseCents: 0,
          netCents: 0,
        });
      }

      let totalIncomeCents = 0;
      let totalExpenseCents = 0;
      let overdueReceivableCents = 0;
      const nowMs = Date.now();

      for (const row of txRows) {
        const isConfirmed = row.status === 'CONFIRMED' || row.status === 'PAID';
        if (row.type === 'receivable' || row.type === 'pos_sale') {
          if (isConfirmed) {
            totalIncomeCents += row.amountCents;
          } else if (
            row.status === 'OVERDUE' ||
            (row.status === 'PENDING' && row.dueDate.getTime() < nowMs)
          ) {
            overdueReceivableCents += row.amountCents;
          }
        } else if (row.type === 'payable' && isConfirmed) {
          totalExpenseCents += row.amountCents;
        }

        const refDate = row.paidAt ?? row.createdAt;
        const dateKey = refDate.toISOString().slice(0, 10);
        const bucket = dailyMap.get(dateKey);
        if (bucket && isConfirmed) {
          if (row.type === 'payable') {
            bucket.expenseCents += row.amountCents;
          } else {
            bucket.incomeCents += row.amountCents;
          }
          bucket.netCents = bucket.incomeCents - bucket.expenseCents;
        }
      }

      // 3. Quote conversion funnel
      const totalQuotes = quoteRows.length;
      const approvedQuotes = quoteRows.filter((q) => q.status === 'APPROVED');
      const rejectedQuotes = quoteRows.filter((q) => q.status === 'REJECTED');
      const pendingQuotes = quoteRows.filter(
        (q) => q.status === 'SENT' || q.status === 'DRAFT',
      );
      const decidedCount = approvedQuotes.length + rejectedQuotes.length;
      const conversionRatePct =
        decidedCount > 0
          ? Math.round((approvedQuotes.length / decidedCount) * 100)
          : approvedQuotes.length > 0
            ? 100
            : 0;

      // 4. SLA & Bottleneck indicators
      const activeOs = osRows.filter(
        (o) => !['DELIVERED', 'CANCELED', 'UNREPAIRABLE'].includes(o.status),
      );
      const avgOpenHours =
        activeOs.length > 0
          ? Math.round(
              activeOs.reduce(
                (acc, o) => acc + (nowMs - o.createdAt.getTime()) / 3600000,
                0,
              ) / activeOs.length,
            )
          : 0;

      const lowStockCount = prodRows.filter(
        (p) => checkStockAlert(p.stockQty, p.minStockQty) !== 'OK',
      ).length;

      return {
        summary: {
          totalCustomers: custRows.length,
          totalOs: osRows.length,
          openOsCount: activeOs.length,
          deliveredCount: osRows.filter((o) => o.status === 'DELIVERED').length,
          avgOpenHours,
          waitingApprovalCount: osRows.filter((o) =>
            ['QUOTE_SENT', 'AWAITING_APPROVAL'].includes(o.status),
          ).length,
          awaitingPartCount: osRows.filter((o) => o.status === 'AWAITING_PART')
            .length,
          warrantyCount: osRows.filter((o) => o.status === 'WARRANTY').length,
          lowStockCount,
        },
        osByStage,
        dailyCashflow: Array.from(dailyMap.values()),
        quoteFunnel: {
          totalQuotes,
          approvedCount: approvedQuotes.length,
          pendingCount: pendingQuotes.length,
          rejectedCount: rejectedQuotes.length,
          conversionRatePct,
          approvedValueCents: approvedQuotes.reduce(
            (sum, q) => sum + q.totalCents,
            0,
          ),
        },
        revenueSummary: {
          totalIncomeCents,
          totalExpenseCents,
          netBalanceCents: totalIncomeCents - totalExpenseCents,
          overdueReceivableCents,
        },
      };
    });
  }
}
