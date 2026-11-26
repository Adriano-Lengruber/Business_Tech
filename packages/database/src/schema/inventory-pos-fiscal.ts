import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { organizations } from './core.js';
import { customers, serviceOrders } from './crm-os.js';

export const suppliers = pgTable(
  'suppliers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 180 }).notNull(),
    cnpj: varchar('cnpj', { length: 20 }),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 24 }),
    leadTimeDays: integer('lead_time_days').notNull().default(3),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('suppliers_org_idx').on(t.organizationId)],
);

export const products = pgTable(
  'products',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    sku: varchar('sku', { length: 60 }).notNull(),
    barcode: varchar('barcode', { length: 60 }),
    name: varchar('name', { length: 180 }).notNull(),
    category: varchar('category', { length: 80 }).notNull().default('hardware'),
    brand: varchar('brand', { length: 80 }),
    unit: varchar('unit', { length: 16 }).notNull().default('UN'),
    costCents: integer('cost_cents').notNull().default(0),
    priceCents: integer('price_cents').notNull().default(0),
    stockQty: integer('stock_qty').notNull().default(0),
    minStockQty: integer('min_stock_qty').notNull().default(2),
    ncm: varchar('ncm', { length: 12 }),
    cfopDefault: varchar('cfop_default', { length: 8 }).notNull().default('5102'),
    csosnDefault: varchar('csosn_default', { length: 8 }).notNull().default('102'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('products_org_sku_idx').on(t.organizationId, t.sku),
    index('products_org_barcode_idx').on(t.organizationId, t.barcode),
  ],
);

export const inventoryMovements = pgTable(
  'inventory_movements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 24 }).notNull(),
    quantityDelta: integer('quantity_delta').notNull(),
    unitCostCents: integer('unit_cost_cents').notNull().default(0),
    referenceType: varchar('reference_type', { length: 40 }),
    referenceId: varchar('reference_id', { length: 120 }),
    note: text('note'),
    actorId: varchar('actor_id', { length: 120 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('inv_movements_org_prod_idx').on(
      t.organizationId,
      t.productId,
      t.createdAt,
    ),
  ],
);

export const purchaseOrders = pgTable(
  'purchase_orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    supplierId: uuid('supplier_id')
      .notNull()
      .references(() => suppliers.id, { onDelete: 'restrict' }),
    code: varchar('code', { length: 40 }).notNull(),
    status: varchar('status', { length: 24 }).notNull().default('ORDERED'),
    totalCostCents: integer('total_cost_cents').notNull().default(0),
    linkedServiceOrderId: uuid('linked_service_order_id').references(
      () => serviceOrders.id,
      { onDelete: 'set null' },
    ),
    expectedArrivalAt: timestamp('expected_arrival_at', { withTimezone: true }),
    notes: text('notes'),
    receivedAt: timestamp('received_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('purchase_orders_org_code_idx').on(t.organizationId, t.code)],
);

export const purchaseOrderItems = pgTable(
  'purchase_order_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    purchaseOrderId: uuid('purchase_order_id')
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    quantity: integer('quantity').notNull(),
    unitCostCents: integer('unit_cost_cents').notNull(),
  },
  (t) => [index('po_items_po_idx').on(t.purchaseOrderId)],
);

export const sales = pgTable(
  'sales',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id').references(() => customers.id, {
      onDelete: 'set null',
    }),
    code: varchar('code', { length: 40 }).notNull(),
    status: varchar('status', { length: 24 }).notNull().default('COMPLETED'),
    paymentMethod: varchar('payment_method', { length: 24 })
      .notNull()
      .default('pix'),
    subtotalCents: integer('subtotal_cents').notNull().default(0),
    discountCents: integer('discount_cents').notNull().default(0),
    totalCents: integer('total_cents').notNull().default(0),
    totalCostCents: integer('total_cost_cents').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('sales_org_code_idx').on(t.organizationId, t.code)],
);

export const saleItems = pgTable(
  'sale_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    saleId: uuid('sale_id')
      .notNull()
      .references(() => sales.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    quantity: integer('quantity').notNull(),
    unitCostCents: integer('unit_cost_cents').notNull(),
    unitPriceCents: integer('unit_price_cents').notNull(),
    totalPriceCents: integer('total_price_cents').notNull(),
  },
  (t) => [index('sale_items_sale_idx').on(t.saleId)],
);

export const fiscalProfiles = pgTable(
  'fiscal_profiles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    taxRegime: varchar('tax_regime', { length: 40 })
      .notNull()
      .default('SIMPLES_NACIONAL'),
    stateUf: varchar('state_uf', { length: 2 }).notNull().default('SP'),
    cityCode: varchar('city_code', { length: 12 }).notNull().default('3550308'),
    nfeSeries: integer('nfe_series').notNull().default(1),
    nfceSeries: integer('nfce_series').notNull().default(1),
    nfseSeries: integer('nfse_series').notNull().default(1),
    providerName: varchar('provider_name', { length: 40 })
      .notNull()
      .default('sandbox'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('fiscal_profiles_org_idx').on(t.organizationId)],
);

export const fiscalDocuments = pgTable(
  'fiscal_documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    docType: varchar('doc_type', { length: 16 }).notNull(),
    status: varchar('status', { length: 24 }).notNull().default('AUTHORIZED'),
    number: integer('number').notNull(),
    series: integer('series').notNull().default(1),
    accessKey: varchar('access_key', { length: 64 }),
    referenceType: varchar('reference_type', { length: 30 }).notNull(),
    referenceId: uuid('reference_id').notNull(),
    totalCents: integer('total_cents').notNull(),
    providerName: varchar('provider_name', { length: 40 })
      .notNull()
      .default('sandbox'),
    rejectionReason: text('rejection_reason'),
    aiDiagnosticHint: text('ai_diagnostic_hint'),
    xmlUrl: text('xml_url'),
    pdfUrl: text('pdf_url'),
    issuedAt: timestamp('issued_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('fiscal_docs_org_created_idx').on(t.organizationId, t.createdAt),
  ],
);
