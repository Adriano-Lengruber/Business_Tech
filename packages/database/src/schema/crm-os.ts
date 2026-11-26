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

export const customers = pgTable(
  'customers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 10 }).notNull().default('PF'),
    name: varchar('name', { length: 180 }).notNull(),
    documentEncrypted: text('document_encrypted'),
    documentHash: varchar('document_hash', { length: 128 }),
    phoneE164: varchar('phone_e164', { length: 24 }).notNull(),
    email: varchar('email', { length: 255 }),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    aiSegment: varchar('ai_segment', { length: 40 }),
    lgpdConsentAt: timestamp('lgpd_consent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('customers_org_phone_idx').on(t.organizationId, t.phoneE164),
    index('customers_org_doc_hash_idx').on(t.organizationId, t.documentHash),
  ],
);

export const assets = pgTable(
  'assets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    category: varchar('category', { length: 60 }).notNull(),
    brand: varchar('brand', { length: 80 }),
    model: varchar('model', { length: 120 }),
    serialNumber: varchar('serial_number', { length: 120 }),
    qrToken: varchar('qr_token', { length: 64 }).notNull(),
    specs: jsonb('specs').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('assets_qr_token_idx').on(t.qrToken),
    index('assets_org_customer_idx').on(t.organizationId, t.customerId),
  ],
);

export const serviceOrders = pgTable(
  'service_orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 40 }).notNull(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),
    assetId: uuid('asset_id').references(() => assets.id, { onDelete: 'set null' }),
    status: varchar('status', { length: 40 }).notNull().default('RECEIVED'),
    priority: varchar('priority', { length: 20 }).notNull().default('NORMAL'),
    reportedSymptoms: text('reported_symptoms').notNull(),
    preliminaryDiagnosis: text('preliminary_diagnosis'),
    intakeChecklist: jsonb('intake_checklist')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    portalTokenHash: varchar('portal_token_hash', { length: 128 }),
    promisedAt: timestamp('promised_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('service_orders_org_code_idx').on(t.organizationId, t.code),
    index('service_orders_org_status_idx').on(t.organizationId, t.status),
  ],
);

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id').references(() => customers.id, {
      onDelete: 'set null',
    }),
    channel: varchar('channel', { length: 30 }).notNull().default('whatsapp'),
    externalThreadId: varchar('external_thread_id', { length: 120 }).notNull(),
    botState: varchar('bot_state', { length: 30 }).notNull().default('BOT_ACTIVE'),
    assignedUserId: uuid('assigned_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    handoffReason: text('handoff_reason'),
    handoffSummary: text('handoff_summary'),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('conversations_org_channel_thread_idx').on(
      t.organizationId,
      t.channel,
      t.externalThreadId,
    ),
    index('conversations_org_state_idx').on(t.organizationId, t.botState),
  ],
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    direction: varchar('direction', { length: 16 }).notNull(),
    senderType: varchar('sender_type', { length: 24 }).notNull(),
    contentText: text('content_text'),
    mediaUrl: text('media_url'),
    audioTranscript: text('audio_transcript'),
    providerMessageId: varchar('provider_message_id', { length: 140 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('messages_conversation_created_idx').on(t.conversationId, t.createdAt),
    uniqueIndex('messages_org_provider_id_idx').on(
      t.organizationId,
      t.providerMessageId,
    ),
  ],
);

export const serviceOrderAttachments = pgTable(
  'service_order_attachments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    serviceOrderId: uuid('service_order_id')
      .notNull()
      .references(() => serviceOrders.id, { onDelete: 'cascade' }),
    kind: varchar('kind', { length: 30 }).notNull().default('intake_photo'),
    filename: varchar('filename', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 120 }).notNull(),
    storageKey: text('storage_key').notNull(),
    sizeBytes: integer('size_bytes').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('os_attachments_org_os_idx').on(t.organizationId, t.serviceOrderId),
  ],
);

export const serviceOrderEvents = pgTable(
  'service_order_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    serviceOrderId: uuid('service_order_id')
      .notNull()
      .references(() => serviceOrders.id, { onDelete: 'cascade' }),
    eventType: varchar('event_type', { length: 60 }).notNull(),
    fromStatus: varchar('from_status', { length: 40 }),
    toStatus: varchar('to_status', { length: 40 }),
    note: text('note'),
    actorType: varchar('actor_type', { length: 30 }).notNull().default('human'),
    actorId: varchar('actor_id', { length: 120 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('os_events_org_os_created_idx').on(
      t.organizationId,
      t.serviceOrderId,
      t.createdAt,
    ),
  ],
);
