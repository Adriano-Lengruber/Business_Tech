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
import { organizations, users } from './core.js';
import { customers } from './crm-os.js';

export const filaments = pgTable(
  'filaments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    materialType: varchar('material_type', { length: 24 }).notNull().default('PLA'),
    color: varchar('color', { length: 60 }).notNull(),
    brand: varchar('brand', { length: 80 }),
    costPerKgCents: integer('cost_per_kg_cents').notNull(),
    stockGrams: integer('stock_grams').notNull().default(1000),
    minGrams: integer('min_grams').notNull().default(250),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('filaments_org_idx').on(t.organizationId)],
);

export const print3dJobs = pgTable(
  'print_3d_jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id').references(() => customers.id, {
      onDelete: 'set null',
    }),
    filamentId: uuid('filament_id')
      .notNull()
      .references(() => filaments.id, { onDelete: 'restrict' }),
    code: varchar('code', { length: 40 }).notNull(),
    modelName: varchar('model_name', { length: 180 }).notNull(),
    stlStorageKey: text('stl_storage_key'),
    status: varchar('status', { length: 30 }).notNull().default('QUEUED'),
    weightGrams: integer('weight_grams').notNull(),
    printTimeMinutes: integer('print_time_minutes').notNull(),
    totalCostCents: integer('total_cost_cents').notNull(),
    salePriceCents: integer('sale_price_cents').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('print_3d_jobs_org_code_idx').on(t.organizationId, t.code),
    index('print_3d_jobs_org_status_idx').on(t.organizationId, t.status),
  ],
);

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id').references(() => customers.id, {
      onDelete: 'set null',
    }),
    code: varchar('code', { length: 40 }).notNull(),
    title: varchar('title', { length: 180 }).notNull(),
    projectType: varchar('project_type', { length: 40 })
      .notNull()
      .default('software_dev'),
    status: varchar('status', { length: 24 }).notNull().default('ACTIVE'),
    budgetCents: integer('budget_cents').notNull().default(0),
    retainerMinutesMonthly: integer('retainer_minutes_monthly')
      .notNull()
      .default(0),
    hourlyRateCents: integer('hourly_rate_cents').notNull().default(15000),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('projects_org_code_idx').on(t.organizationId, t.code)],
);

export const projectTasks = pgTable(
  'project_tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 180 }).notNull(),
    status: varchar('status', { length: 24 }).notNull().default('BACKLOG'),
    priority: varchar('priority', { length: 20 }).notNull().default('NORMAL'),
    estimatedMinutes: integer('estimated_minutes').notNull().default(60),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('project_tasks_proj_idx').on(t.projectId)],
);

export const projectTimeEntries = pgTable(
  'project_time_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id').references(() => projectTasks.id, {
      onDelete: 'set null',
    }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    minutes: integer('minutes').notNull(),
    description: varchar('description', { length: 300 }).notNull(),
    billable: boolean('billable').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('project_time_proj_idx').on(t.projectId)],
);

export const socialPosts = pgTable(
  'social_posts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    platform: varchar('platform', { length: 30 }).notNull().default('instagram'),
    status: varchar('status', { length: 30 }).notNull().default('DRAFT'),
    title: varchar('title', { length: 160 }).notNull(),
    caption: text('caption').notNull(),
    hashtags: text('hashtags'),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    externalPostId: varchar('external_post_id', { length: 140 }),
    impressions: integer('impressions').notNull().default(0),
    likes: integer('likes').notNull().default(0),
    commentsCount: integer('comments_count').notNull().default(0),
    leadsGenerated: integer('leads_generated').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('social_posts_org_idx').on(t.organizationId, t.createdAt)],
);

export const leads = pgTable(
  'leads',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    source: varchar('source', { length: 40 }).notNull().default('landing_page'),
    sourceRefId: varchar('source_ref_id', { length: 120 }),
    name: varchar('name', { length: 160 }).notNull(),
    phoneE164: varchar('phone_e164', { length: 24 }),
    notes: text('notes'),
    stage: varchar('stage', { length: 30 }).notNull().default('NEW'),
    aiScore: integer('ai_score').notNull().default(50),
    convertedCustomerId: uuid('converted_customer_id').references(
      () => customers.id,
      { onDelete: 'set null' },
    ),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('leads_org_stage_idx').on(t.organizationId, t.stage)],
);
