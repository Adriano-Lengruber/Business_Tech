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

export interface DiagnosticTestItem {
  name: string;
  passed: boolean;
  notes?: string;
}

export const osDiagnostics = pgTable(
  'os_diagnostics',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    serviceOrderId: uuid('service_order_id')
      .notNull()
      .references(() => serviceOrders.id, { onDelete: 'cascade' }),
    category: varchar('category', { length: 60 }).notNull().default('geral'),
    observedFacts: text('observed_facts').notNull(),
    testsPerformed: jsonb('tests_performed')
      .$type<DiagnosticTestItem[]>()
      .notNull()
      .default([]),
    aiHypotheses: jsonb('ai_hypotheses')
      .$type<string[]>()
      .notNull()
      .default([]),
    finalDiagnosis: text('final_diagnosis'),
    confidenceLevel: varchar('confidence_level', { length: 20 })
      .notNull()
      .default('medium'),
    clientExplanation: text('client_explanation'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('os_diagnostics_org_os_idx').on(t.organizationId, t.serviceOrderId),
  ],
);

export const quotes = pgTable(
  'quotes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    serviceOrderId: uuid('service_order_id')
      .notNull()
      .references(() => serviceOrders.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 40 }).notNull(),
    tier: varchar('tier', { length: 20 }).notNull().default('recommended'),
    status: varchar('status', { length: 20 }).notNull().default('DRAFT'),
    warrantyDays: integer('warranty_days').notNull().default(90),
    validUntil: timestamp('valid_until', { withTimezone: true }).notNull(),
    paymentTerms: varchar('payment_terms', { length: 240 }).notNull(),
    clientNotes: text('client_notes'),
    subtotalCents: integer('subtotal_cents').notNull().default(0),
    discountCents: integer('discount_cents').notNull().default(0),
    totalCents: integer('total_cents').notNull().default(0),
    estimatedCostCents: integer('estimated_cost_cents').notNull().default(0),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    acceptedIp: varchar('accepted_ip', { length: 64 }),
    acceptedUserAgent: text('accepted_user_agent'),
    acceptanceHash: varchar('acceptance_hash', { length: 128 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('quotes_org_code_idx').on(t.organizationId, t.code),
    index('quotes_org_os_idx').on(t.organizationId, t.serviceOrderId),
  ],
);

export const quoteItems = pgTable(
  'quote_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    quoteId: uuid('quote_id')
      .notNull()
      .references(() => quotes.id, { onDelete: 'cascade' }),
    itemType: varchar('item_type', { length: 24 }).notNull(),
    description: varchar('description', { length: 240 }).notNull(),
    quantity: integer('quantity').notNull().default(1),
    unitCostCents: integer('unit_cost_cents').notNull().default(0),
    unitPriceCents: integer('unit_price_cents').notNull().default(0),
    totalPriceCents: integer('total_price_cents').notNull().default(0),
    approvedByCustomer: boolean('approved_by_customer').notNull().default(true),
  },
  (t) => [index('quote_items_quote_idx').on(t.quoteId)],
);

export const financialTransactions = pgTable(
  'financial_transactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    serviceOrderId: uuid('service_order_id').references(() => serviceOrders.id, {
      onDelete: 'set null',
    }),
    quoteId: uuid('quote_id').references(() => quotes.id, {
      onDelete: 'set null',
    }),
    type: varchar('type', { length: 20 }).notNull(),
    category: varchar('category', { length: 80 }).notNull(),
    description: varchar('description', { length: 240 }).notNull(),
    paymentMethod: varchar('payment_method', { length: 24 })
      .notNull()
      .default('pix'),
    status: varchar('status', { length: 24 }).notNull().default('PENDING'),
    amountCents: integer('amount_cents').notNull(),
    dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    gatewayProvider: varchar('gateway_provider', { length: 40 }),
    gatewayChargeId: varchar('gateway_charge_id', { length: 140 }),
    pixCopyPaste: text('pix_copy_paste'),
    invoiceUrl: text('invoice_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('fin_tx_org_status_due_idx').on(t.organizationId, t.status, t.dueDate),
    uniqueIndex('fin_tx_org_gateway_charge_idx').on(
      t.organizationId,
      t.gatewayChargeId,
    ),
  ],
);
