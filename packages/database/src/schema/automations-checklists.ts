import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { organizations, users } from './core.js';
import { serviceOrders } from './crm-os.js';

export interface ChecklistTemplateItem {
  key: string;
  label: string;
  required: boolean;
}

export interface ChecklistResponseEntry {
  checked: boolean;
  note?: string;
}

export const checklistTemplates = pgTable(
  'checklist_templates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    category: varchar('category', { length: 60 }).notNull().default('notebook'),
    title: varchar('title', { length: 160 }).notNull(),
    items: jsonb('items').$type<ChecklistTemplateItem[]>().notNull().default([]),
    blockClosingIfIncomplete: boolean('block_closing_if_incomplete')
      .notNull()
      .default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('checklist_templates_org_cat_idx').on(t.organizationId, t.category),
  ],
);

export const serviceOrderChecklists = pgTable(
  'service_order_checklists',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    serviceOrderId: uuid('service_order_id')
      .notNull()
      .references(() => serviceOrders.id, { onDelete: 'cascade' }),
    templateId: uuid('template_id').references(() => checklistTemplates.id, {
      onDelete: 'set null',
    }),
    title: varchar('title', { length: 160 }).notNull(),
    items: jsonb('items').$type<ChecklistTemplateItem[]>().notNull().default([]),
    responses: jsonb('responses')
      .$type<Record<string, ChecklistResponseEntry>>()
      .notNull()
      .default({}),
    blockClosingIfIncomplete: boolean('block_closing_if_incomplete')
      .notNull()
      .default(true),
    completedRequired: boolean('completed_required').notNull().default(false),
    updatedByUserId: uuid('updated_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('os_checklists_org_os_idx').on(
      t.organizationId,
      t.serviceOrderId,
    ),
  ],
);

export const automationRules = pgTable(
  'automation_rules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 160 }).notNull(),
    triggerEvent: varchar('trigger_event', { length: 60 }).notNull(),
    channel: varchar('channel', { length: 30 }).notNull().default('internal_alert'),
    delayHours: integer('delay_hours').notNull().default(48),
    templateText: text('template_text').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
    runCount: integer('run_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('automation_rules_org_trigger_idx').on(
      t.organizationId,
      t.triggerEvent,
    ),
  ],
);

export const automationExecutions = pgTable(
  'automation_executions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    ruleId: uuid('rule_id')
      .notNull()
      .references(() => automationRules.id, { onDelete: 'cascade' }),
    targetEntityType: varchar('target_entity_type', { length: 40 }).notNull(),
    targetEntityId: varchar('target_entity_id', { length: 120 }).notNull(),
    targetLabel: varchar('target_label', { length: 200 }).notNull(),
    status: varchar('status', { length: 24 }).notNull().default('EXECUTED'),
    summary: text('summary').notNull(),
    executedAt: timestamp('executed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('automation_exec_idempotent_idx').on(
      t.organizationId,
      t.ruleId,
      t.targetEntityType,
      t.targetEntityId,
    ),
  ],
);
