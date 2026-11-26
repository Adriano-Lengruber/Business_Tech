import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  auditLogs,
  automationExecutions,
  automationRules,
  desc,
  eq,
  products,
  quotes,
  serviceOrders,
} from '@al/database';
import { checkStockAlert, type CreateAutomationRuleInput } from '@al/shared';
import { DatabaseService } from '../database/database.module';

@Injectable()
export class AutomationsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async listOverview(organizationId: string) {
    return this.database.withTenant(organizationId, async (tx) => {
      const [rules, executions] = await Promise.all([
        tx
          .select()
          .from(automationRules)
          .orderBy(desc(automationRules.createdAt)),
        tx
          .select()
          .from(automationExecutions)
          .orderBy(desc(automationExecutions.executedAt))
          .limit(30),
      ]);

      return {
        rules,
        executions,
        summary: {
          totalRules: rules.length,
          activeRules: rules.filter((r) => r.isActive).length,
          totalExecutions: executions.length,
        },
      };
    });
  }

  async createRule(
    organizationId: string,
    userId: string,
    input: CreateAutomationRuleInput,
  ) {
    return this.database.withTenant(organizationId, async (tx) => {
      const [rule] = await tx
        .insert(automationRules)
        .values({
          organizationId,
          name: input.name.trim(),
          triggerEvent: input.triggerEvent,
          channel: input.channel,
          delayHours: input.delayHours,
          templateText: input.templateText.trim(),
          isActive: true,
        })
        .returning();

      await tx.insert(auditLogs).values({
        organizationId,
        actorType: 'human',
        actorId: userId,
        action: 'automation_rule.created',
        entityType: 'automation_rule',
        entityId: rule!.id,
        afterState: {
          name: rule!.name,
          triggerEvent: rule!.triggerEvent,
        },
      });

      return rule!;
    });
  }

  async toggleRule(organizationId: string, id: string) {
    return this.database.withTenant(organizationId, async (tx) => {
      const [existing] = await tx
        .select()
        .from(automationRules)
        .where(eq(automationRules.id, id))
        .limit(1);

      if (!existing) {
        throw new NotFoundException('Regra de automação não encontrada.');
      }

      const [updated] = await tx
        .update(automationRules)
        .set({ isActive: !existing.isActive })
        .where(eq(automationRules.id, id))
        .returning();

      return updated!;
    });
  }

  async runActiveRules(organizationId: string, userId: string) {
    return this.database.withTenant(organizationId, async (tx) => {
      const rules = await tx
        .select()
        .from(automationRules)
        .where(eq(automationRules.isActive, true));

      const [quoteRows, osRows, prodRows] = await Promise.all([
        tx.select().from(quotes),
        tx.select().from(serviceOrders),
        tx.select().from(products),
      ]);

      const nowMs = Date.now();
      let newExecutionsCount = 0;
      const results: Array<{
        ruleName: string;
        targetLabel: string;
        summary: string;
      }> = [];

      for (const rule of rules) {
        const thresholdMs = rule.delayHours * 3600000;
        const candidates: Array<{
          entityType: string;
          entityId: string;
          label: string;
          summary: string;
        }> = [];

        if (rule.triggerEvent === 'quote.pending_followup') {
          for (const q of quoteRows) {
            if (
              q.status === 'SENT' &&
              nowMs - q.createdAt.getTime() >= thresholdMs
            ) {
              candidates.push({
                entityType: 'quote',
                entityId: q.id,
                label: `Orçamento ${q.code}`,
                summary: `Follow-up automático (${rule.channel}): ${rule.templateText}`,
              });
            }
          }
        } else if (rule.triggerEvent === 'os.ready_pickup_reminder') {
          for (const os of osRows) {
            if (
              ['READY', 'AWAITING_PICKUP'].includes(os.status) &&
              nowMs - os.updatedAt.getTime() >= thresholdMs
            ) {
              candidates.push({
                entityType: 'service_order',
                entityId: os.id,
                label: `OS ${os.code}`,
                summary: `Lembrete de retirada (${rule.channel}): ${rule.templateText}`,
              });
            }
          }
        } else if (rule.triggerEvent === 'os.post_service_preventive') {
          for (const os of osRows) {
            const refDate = os.closedAt ?? os.updatedAt;
            if (
              os.status === 'DELIVERED' &&
              nowMs - refDate.getTime() >= thresholdMs
            ) {
              candidates.push({
                entityType: 'service_order_preventive',
                entityId: os.id,
                label: `Revisão preventiva pós-${os.code}`,
                summary: `Aviso preventivo pós-serviço (${rule.channel}): ${rule.templateText}`,
              });
            }
          }
        } else if (rule.triggerEvent === 'stock.low_alert') {
          for (const prod of prodRows) {
            if (checkStockAlert(prod.stockQty, prod.minStockQty) !== 'OK') {
              candidates.push({
                entityType: 'product',
                entityId: prod.id,
                label: `${prod.sku} — ${prod.name}`,
                summary: `Alerta de reposição: saldo atual ${prod.stockQty} (mín. ${prod.minStockQty}).`,
              });
            }
          }
        }

        let ruleNewHits = 0;
        for (const c of candidates) {
          const inserted = await tx
            .insert(automationExecutions)
            .values({
              organizationId,
              ruleId: rule.id,
              targetEntityType: c.entityType,
              targetEntityId: c.entityId,
              targetLabel: c.label,
              status: 'EXECUTED',
              summary: c.summary,
            })
            .onConflictDoNothing()
            .returning({ id: automationExecutions.id });

          if (inserted.length > 0) {
            ruleNewHits++;
            newExecutionsCount++;
            results.push({
              ruleName: rule.name,
              targetLabel: c.label,
              summary: c.summary,
            });
          }
        }

        await tx
          .update(automationRules)
          .set({
            lastRunAt: new Date(),
            runCount: rule.runCount + ruleNewHits,
          })
          .where(eq(automationRules.id, rule.id));
      }

      if (newExecutionsCount > 0) {
        await tx.insert(auditLogs).values({
          organizationId,
          actorType: 'automation',
          actorId: userId,
          action: 'automations.batch_executed',
          entityType: 'automation_rule',
          afterState: { newExecutionsCount },
        });
      }

      return {
        evaluatedRules: rules.length,
        newExecutionsCount,
        results,
      };
    });
  }
}
