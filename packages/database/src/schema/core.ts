import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: varchar('slug', { length: 100 }).notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    cnpj: varchar('cnpj', { length: 18 }),
    planCode: varchar('plan_code', { length: 50 }).notNull().default('starter'),
    aiPrivacyMode: varchar('ai_privacy_mode', { length: 30 })
      .notNull()
      .default('strict_local'),
    settings: jsonb('settings').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('organizations_slug_idx').on(t.slug)],
);

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 255 }).notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('users_email_idx').on(t.email)],
);

export const memberships = pgTable(
  'memberships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 40 }).notNull().default('technician'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('memberships_org_user_idx').on(t.organizationId, t.userId),
    index('memberships_user_idx').on(t.userId),
  ],
);

export const tenantModules = pgTable(
  'tenant_modules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    moduleCode: varchar('module_code', { length: 60 }).notNull(),
    enabled: boolean('enabled').notNull().default(true),
    limits: jsonb('limits').$type<Record<string, unknown>>().notNull().default({}),
    config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
    activatedAt: timestamp('activated_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('tenant_modules_org_code_idx').on(t.organizationId, t.moduleCode),
  ],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    actorType: varchar('actor_type', { length: 30 }).notNull(), // human | ai_agent | automation
    actorId: varchar('actor_id', { length: 120 }).notNull(),
    action: varchar('action', { length: 120 }).notNull(),
    entityType: varchar('entity_type', { length: 80 }).notNull(),
    entityId: varchar('entity_id', { length: 120 }),
    beforeState: jsonb('before_state').$type<Record<string, unknown> | null>(),
    afterState: jsonb('after_state').$type<Record<string, unknown> | null>(),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('audit_logs_org_created_idx').on(t.organizationId, t.createdAt),
  ],
);
