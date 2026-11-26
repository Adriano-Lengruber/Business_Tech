import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  jsonb,
  timestamp,
  index,
  customType,
} from 'drizzle-orm/pg-core';
import { organizations } from './core.js';
import { conversations, serviceOrders } from './crm-os.js';

const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(1024)';
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    return value
      .replace(/^\[|\]$/g, '')
      .split(',')
      .filter(Boolean)
      .map(Number);
  },
});

export const knowledgeDocuments = pgTable('knowledge_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 200 }).notNull(),
  sourceType: varchar('source_type', { length: 40 }).notNull(),
  sha256: varchar('sha256', { length: 64 }).notNull(),
  storageKey: text('storage_key').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const knowledgeChunks = pgTable(
  'knowledge_chunks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    documentId: uuid('document_id')
      .notNull()
      .references(() => knowledgeDocuments.id, { onDelete: 'cascade' }),
    chunkIndex: integer('chunk_index').notNull(),
    content: text('content').notNull(),
    embedding: vector('embedding'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('knowledge_chunks_org_doc_idx').on(t.organizationId, t.documentId)],
);

export const aiAgentRuns = pgTable(
  'ai_agent_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id').references(() => conversations.id, {
      onDelete: 'set null',
    }),
    serviceOrderId: uuid('service_order_id').references(() => serviceOrders.id, {
      onDelete: 'set null',
    }),
    agentName: varchar('agent_name', { length: 80 }).notNull(),
    provider: varchar('provider', { length: 40 }).notNull(),
    model: varchar('model', { length: 100 }).notNull(),
    promptTokens: integer('prompt_tokens').notNull().default(0),
    completionTokens: integer('completion_tokens').notNull().default(0),
    latencyMs: integer('latency_ms').notNull().default(0),
    toolsCalled: jsonb('tools_called').$type<unknown[]>().notNull().default([]),
    riskLevel: varchar('risk_level', { length: 30 }).notNull().default('READ_ONLY'),
    humanApprovalStatus: varchar('human_approval_status', { length: 30 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('ai_agent_runs_org_created_idx').on(t.organizationId, t.createdAt)],
);
