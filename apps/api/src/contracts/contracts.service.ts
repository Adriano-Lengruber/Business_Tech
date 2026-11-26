import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  auditLogs,
  customers,
  desc,
  eq,
  financialTransactions,
  maintenanceContracts,
  sql,
} from '@al/database';
import type {
  CreateMaintenanceContractInput,
  LogContractUsageInput,
} from '@al/shared';
import { DatabaseService } from '../database/database.module';

@Injectable()
export class ContractsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async list(organizationId: string) {
    return this.database.withTenant(organizationId, async (tx) => {
      const rows = await tx
        .select({
          contract: maintenanceContracts,
          customerName: customers.name,
          customerPhone: customers.phoneE164,
        })
        .from(maintenanceContracts)
        .innerJoin(customers, eq(maintenanceContracts.customerId, customers.id))
        .orderBy(desc(maintenanceContracts.createdAt));

      const active = rows.filter((r) => r.contract.status === 'ACTIVE');
      const mrrCents = active.reduce(
        (sum, r) => sum + r.contract.monthlyPriceCents,
        0,
      );
      const dueThreshold = Date.now() + 15 * 86400000;
      const preventiveDueCount = active.filter(
        (r) =>
          r.contract.nextPreventiveAt &&
          r.contract.nextPreventiveAt.getTime() <= dueThreshold,
      ).length;

      return {
        contracts: rows.map((r) => ({
          ...r.contract,
          customerName: r.customerName,
          customerPhone: r.customerPhone,
        })),
        summary: {
          activeCount: active.length,
          mrrCents,
          totalCoveredAssets: active.reduce(
            (sum, r) => sum + r.contract.coveredAssetsCount,
            0,
          ),
          preventiveDueCount,
        },
      };
    });
  }

  async create(
    organizationId: string,
    userId: string,
    input: CreateMaintenanceContractInput,
  ) {
    return this.database.withTenant(organizationId, async (tx) => {
      const countRes = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(maintenanceContracts);
      const nextNum = (countRes[0]?.count ?? 0) + 1;
      const code = `CTR-${new Date().getFullYear()}-${String(nextNum).padStart(4, '0')}`;
      const nextPreventiveAt = new Date(
        Date.now() + input.preventiveFrequencyDays * 86400000,
      );

      const [created] = await tx
        .insert(maintenanceContracts)
        .values({
          organizationId,
          customerId: input.customerId,
          code,
          title: input.title.trim(),
          planTier: input.planTier,
          status: 'ACTIVE',
          monthlyPriceCents: input.monthlyPriceCents,
          includedHours: input.includedHours,
          usedHours: 0,
          slaResponseHours: input.slaResponseHours,
          coveredAssetsCount: input.coveredAssetsCount,
          preventiveFrequencyDays: input.preventiveFrequencyDays,
          nextPreventiveAt,
          notes: input.notes?.trim() || null,
        })
        .returning();

      await tx.insert(auditLogs).values({
        organizationId,
        actorType: 'human',
        actorId: userId,
        action: 'contract.created',
        entityType: 'maintenance_contract',
        entityId: created!.id,
        afterState: {
          code,
          monthlyPriceCents: input.monthlyPriceCents,
          slaResponseHours: input.slaResponseHours,
        },
      });

      return created!;
    });
  }

  async logUsage(
    organizationId: string,
    contractId: string,
    userId: string,
    input: LogContractUsageInput,
  ) {
    return this.database.withTenant(organizationId, async (tx) => {
      const [existing] = await tx
        .select()
        .from(maintenanceContracts)
        .where(eq(maintenanceContracts.id, contractId))
        .limit(1);

      if (!existing) {
        throw new NotFoundException('Contrato não encontrado.');
      }

      const [updated] = await tx
        .update(maintenanceContracts)
        .set({
          usedHours: existing.usedHours + input.hoursUsed,
          updatedAt: new Date(),
        })
        .where(eq(maintenanceContracts.id, contractId))
        .returning();

      await tx.insert(auditLogs).values({
        organizationId,
        actorType: 'human',
        actorId: userId,
        action: 'contract.hours_logged',
        entityType: 'maintenance_contract',
        entityId: contractId,
        beforeState: { usedHours: existing.usedHours },
        afterState: { usedHours: updated!.usedHours },
        reason: input.notes?.trim() || null,
      });

      return updated!;
    });
  }

  async recordPreventiveDone(
    organizationId: string,
    contractId: string,
    userId: string,
  ) {
    return this.database.withTenant(organizationId, async (tx) => {
      const [existing] = await tx
        .select()
        .from(maintenanceContracts)
        .where(eq(maintenanceContracts.id, contractId))
        .limit(1);

      if (!existing) {
        throw new NotFoundException('Contrato não encontrado.');
      }

      const nextPreventiveAt = new Date(
        Date.now() + existing.preventiveFrequencyDays * 86400000,
      );

      const [updated] = await tx
        .update(maintenanceContracts)
        .set({
          nextPreventiveAt,
          updatedAt: new Date(),
        })
        .where(eq(maintenanceContracts.id, contractId))
        .returning();

      await tx.insert(auditLogs).values({
        organizationId,
        actorType: 'human',
        actorId: userId,
        action: 'contract.preventive_completed',
        entityType: 'maintenance_contract',
        entityId: contractId,
        afterState: { nextPreventiveAt: nextPreventiveAt.toISOString() },
      });

      return updated!;
    });
  }

  async billMonthlyFee(
    organizationId: string,
    contractId: string,
    userId: string,
  ) {
    return this.database.withTenant(organizationId, async (tx) => {
      const [existing] = await tx
        .select()
        .from(maintenanceContracts)
        .where(eq(maintenanceContracts.id, contractId))
        .limit(1);

      if (!existing) {
        throw new NotFoundException('Contrato não encontrado.');
      }

      const [txRow] = await tx
        .insert(financialTransactions)
        .values({
          organizationId,
          type: 'receivable',
          status: 'PENDING',
          category: 'contrato_recorrente',
          description: `Mensalidade ${existing.code} — ${existing.title}`,
          amountCents: existing.monthlyPriceCents,
          paymentMethod: 'PIX',
          dueDate: new Date(Date.now() + 5 * 86400000),
        })
        .returning();

      await tx.insert(auditLogs).values({
        organizationId,
        actorType: 'human',
        actorId: userId,
        action: 'contract.monthly_billed',
        entityType: 'maintenance_contract',
        entityId: contractId,
        afterState: {
          transactionId: txRow!.id,
          amountCents: existing.monthlyPriceCents,
        },
      });

      return txRow!;
    });
  }
}
