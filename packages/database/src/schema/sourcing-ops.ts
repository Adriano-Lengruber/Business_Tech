import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { organizations, users } from './core.js';
import { serviceOrders } from './crm-os.js';
import { suppliers } from './inventory-pos-fiscal.js';

export const serviceOrderTimeEntries = pgTable(
  'service_order_time_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    serviceOrderId: uuid('service_order_id')
      .notNull()
      .references(() => serviceOrders.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    mode: varchar('mode', { length: 24 }).notNull().default('active_bench'),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    durationSeconds: integer('duration_seconds').notNull().default(0),
    note: varchar('note', { length: 300 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('os_time_entries_org_os_idx').on(t.organizationId, t.serviceOrderId),
  ],
);

export const sourcingRequests = pgTable(
  'sourcing_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 40 }).notNull(),
    itemName: varchar('item_name', { length: 200 }).notNull(),
    category: varchar('category', { length: 60 }).notNull().default('hardware'),
    desiredQty: integer('desired_qty').notNull().default(1),
    targetResalePriceCents: integer('target_resale_price_cents'),
    urgency: varchar('urgency', { length: 20 }).notNull().default('normal'),
    status: varchar('status', { length: 24 }).notNull().default('OPEN'),
    selectedOfferId: uuid('selected_offer_id'),
    aiRecommendation: text('ai_recommendation'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('sourcing_requests_org_code_idx').on(t.organizationId, t.code),
    index('sourcing_requests_org_status_idx').on(t.organizationId, t.status),
  ],
);

export const sourcingOffers = pgTable(
  'sourcing_offers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    requestId: uuid('request_id')
      .notNull()
      .references(() => sourcingRequests.id, { onDelete: 'cascade' }),
    supplierId: uuid('supplier_id').references(() => suppliers.id, {
      onDelete: 'set null',
    }),
    channelType: varchar('channel_type', { length: 24 })
      .notNull()
      .default('supplier_b2b'),
    vendorName: varchar('vendor_name', { length: 160 }).notNull(),
    unitPriceCents: integer('unit_price_cents').notNull(),
    shippingCents: integer('shipping_cents').notNull().default(0),
    taxOrFeeCents: integer('tax_or_fee_cents').notNull().default(0),
    landedUnitCostCents: integer('landed_unit_cost_cents').notNull(),
    deliveryDays: integer('delivery_days').notNull().default(3),
    paymentTerms: varchar('payment_terms', { length: 120 }),
    sourceUrl: text('source_url'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('sourcing_offers_org_req_idx').on(t.organizationId, t.requestId),
  ],
);
