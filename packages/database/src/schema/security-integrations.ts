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

export const tenantApiKeys = pgTable(
  'tenant_api_keys',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 140 }).notNull(),
    keyPrefix: varchar('key_prefix', { length: 24 }).notNull(),
    keyHash: varchar('key_hash', { length: 128 }).notNull(),
    scopes: jsonb('scopes').$type<string[]>().notNull().default(['os:read']),
    isActive: boolean('is_active').notNull().default(true),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('tenant_api_keys_hash_idx').on(t.keyHash),
    index('tenant_api_keys_org_idx').on(t.organizationId),
  ],
);

export const webhookEndpoints = pgTable(
  'webhook_endpoints',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 140 }).notNull(),
    targetUrl: text('target_url').notNull(),
    events: jsonb('events')
      .$type<string[]>()
      .notNull()
      .default(['service_order.created', 'quote.approved']),
    secretEncrypted: text('secret_encrypted').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    lastStatusCode: integer('last_status_code'),
    lastDeliveredAt: timestamp('last_delivered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('webhook_endpoints_org_idx').on(t.organizationId)],
);
