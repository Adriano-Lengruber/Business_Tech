import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { organizations, users } from './core.js';
import { assets, customers, serviceOrders } from './crm-os.js';

export const hardwareDiagnosticSnapshots = pgTable(
  'hardware_diagnostic_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    serviceOrderId: uuid('service_order_id')
      .notNull()
      .references(() => serviceOrders.id, { onDelete: 'cascade' }),
    assetId: uuid('asset_id').references(() => assets.id, {
      onDelete: 'set null',
    }),
    stage: varchar('stage', { length: 16 }).notNull().default('BEFORE'),
    source: varchar('source', { length: 32 }).notNull().default('manual'),
    cpuModel: varchar('cpu_model', { length: 160 }),
    ramGb: integer('ram_gb'),
    storageSummary: varchar('storage_summary', { length: 180 }),
    smartHealthPct: integer('smart_health_pct'),
    batteryHealthPct: integer('battery_health_pct'),
    osVersion: varchar('os_version', { length: 140 }),
    cpuTempCelsius: integer('cpu_temp_celsius'),
    notes: text('notes'),
    rawPayload: jsonb('raw_payload')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    capturedByUserId: uuid('captured_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('hw_snapshots_org_os_idx').on(t.organizationId, t.serviceOrderId),
  ],
);

export const warrantyCases = pgTable(
  'warranty_cases',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    serviceOrderId: uuid('service_order_id')
      .notNull()
      .references(() => serviceOrders.id, { onDelete: 'cascade' }),
    assetId: uuid('asset_id').references(() => assets.id, {
      onDelete: 'set null',
    }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),
    code: varchar('code', { length: 40 }).notNull(),
    kind: varchar('kind', { length: 24 }).notNull().default('service'),
    status: varchar('status', { length: 24 }).notNull().default('ACTIVE'),
    warrantyDays: integer('warranty_days').notNull().default(90),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    supplierName: varchar('supplier_name', { length: 160 }),
    partDescription: varchar('part_description', { length: 200 }),
    notes: text('notes'),
    resolutionNotes: text('resolution_notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('warranty_cases_org_code_idx').on(t.organizationId, t.code),
    index('warranty_cases_org_os_idx').on(t.organizationId, t.serviceOrderId),
  ],
);

export const maintenanceContracts = pgTable(
  'maintenance_contracts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),
    code: varchar('code', { length: 40 }).notNull(),
    title: varchar('title', { length: 180 }).notNull(),
    planTier: varchar('plan_tier', { length: 30 }).notNull().default('preventive'),
    status: varchar('status', { length: 24 }).notNull().default('ACTIVE'),
    monthlyPriceCents: integer('monthly_price_cents').notNull(),
    includedHours: integer('included_hours').notNull().default(8),
    usedHours: integer('used_hours').notNull().default(0),
    slaResponseHours: integer('sla_response_hours').notNull().default(4),
    coveredAssetsCount: integer('covered_assets_count').notNull().default(5),
    preventiveFrequencyDays: integer('preventive_frequency_days')
      .notNull()
      .default(90),
    nextPreventiveAt: timestamp('next_preventive_at', { withTimezone: true }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('maintenance_contracts_org_code_idx').on(
      t.organizationId,
      t.code,
    ),
    index('maintenance_contracts_org_status_idx').on(t.organizationId, t.status),
  ],
);

export const serviceCatalogItems = pgTable(
  'service_catalog_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 40 }).notNull(),
    name: varchar('name', { length: 180 }).notNull(),
    category: varchar('category', { length: 60 }).notNull().default('manutencao'),
    defaultLaborCents: integer('default_labor_cents').notNull().default(0),
    estimatedCostCents: integer('estimated_cost_cents').notNull().default(0),
    defaultWarrantyDays: integer('default_warranty_days').notNull().default(90),
    estimatedHours: integer('estimated_hours').notNull().default(2),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('service_catalog_org_code_idx').on(t.organizationId, t.code),
  ],
);
