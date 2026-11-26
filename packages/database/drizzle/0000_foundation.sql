-- AL Business OS — Migration 0000: Fundação Multi-Tenant, RLS e Domínios Base
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Role não-privilegiada para garantir enforcement real de Row-Level Security
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'al_app') THEN
    CREATE ROLE al_app NOLOGIN;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(100) NOT NULL,
  name varchar(160) NOT NULL,
  cnpj varchar(18),
  plan_code varchar(50) NOT NULL DEFAULT 'starter',
  ai_privacy_mode varchar(30) NOT NULL DEFAULT 'strict_local',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS organizations_slug_idx ON organizations (slug);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(255) NOT NULL,
  name varchar(160) NOT NULL,
  password_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (email);

CREATE TABLE IF NOT EXISTS memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role varchar(40) NOT NULL DEFAULT 'technician',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS memberships_org_user_idx ON memberships (organization_id, user_id);
CREATE INDEX IF NOT EXISTS memberships_user_idx ON memberships (user_id);

CREATE TABLE IF NOT EXISTS tenant_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_code varchar(60) NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  activated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS tenant_modules_org_code_idx ON tenant_modules (organization_id, module_code);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_type varchar(30) NOT NULL,
  actor_id varchar(120) NOT NULL,
  action varchar(120) NOT NULL,
  entity_type varchar(80) NOT NULL,
  entity_id varchar(120),
  before_state jsonb,
  after_state jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_org_created_idx ON audit_logs (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type varchar(10) NOT NULL DEFAULT 'PF',
  name varchar(180) NOT NULL,
  document_encrypted text,
  document_hash varchar(128),
  phone_e164 varchar(24) NOT NULL,
  email varchar(255),
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_segment varchar(40),
  lgpd_consent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS customers_org_phone_idx ON customers (organization_id, phone_e164);
CREATE INDEX IF NOT EXISTS customers_org_doc_hash_idx ON customers (organization_id, document_hash);
CREATE INDEX IF NOT EXISTS customers_name_trgm_idx ON customers USING gin (name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  category varchar(60) NOT NULL,
  brand varchar(80),
  model varchar(120),
  serial_number varchar(120),
  qr_token varchar(64) NOT NULL,
  specs jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS assets_qr_token_idx ON assets (qr_token);
CREATE INDEX IF NOT EXISTS assets_org_customer_idx ON assets (organization_id, customer_id);

CREATE TABLE IF NOT EXISTS service_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code varchar(40) NOT NULL,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
  status varchar(40) NOT NULL DEFAULT 'RECEIVED',
  priority varchar(20) NOT NULL DEFAULT 'NORMAL',
  reported_symptoms text NOT NULL,
  preliminary_diagnosis text,
  intake_checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  portal_token_hash varchar(128),
  promised_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS service_orders_org_code_idx ON service_orders (organization_id, code);
CREATE INDEX IF NOT EXISTS service_orders_org_status_idx ON service_orders (organization_id, status);

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  channel varchar(30) NOT NULL DEFAULT 'whatsapp',
  external_thread_id varchar(120) NOT NULL,
  bot_state varchar(30) NOT NULL DEFAULT 'BOT_ACTIVE',
  assigned_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  handoff_reason text,
  handoff_summary text,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS conversations_org_channel_thread_idx
  ON conversations (organization_id, channel, external_thread_id);
CREATE INDEX IF NOT EXISTS conversations_org_state_idx ON conversations (organization_id, bot_state);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction varchar(16) NOT NULL,
  sender_type varchar(24) NOT NULL,
  content_text text,
  media_url text,
  audio_transcript text,
  provider_message_id varchar(140),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_conversation_created_idx ON messages (conversation_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS messages_org_provider_id_idx ON messages (organization_id, provider_message_id);

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title varchar(200) NOT NULL,
  source_type varchar(40) NOT NULL,
  sha256 varchar(64) NOT NULL,
  storage_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  embedding vector(1024),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS knowledge_chunks_org_doc_idx ON knowledge_chunks (organization_id, document_id);
CREATE INDEX IF NOT EXISTS knowledge_chunks_content_fts_idx
  ON knowledge_chunks USING gin (to_tsvector('portuguese', content));
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_hnsw_idx
  ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS ai_agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  service_order_id uuid REFERENCES service_orders(id) ON DELETE SET NULL,
  agent_name varchar(80) NOT NULL,
  provider varchar(40) NOT NULL,
  model varchar(100) NOT NULL,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  latency_ms integer NOT NULL DEFAULT 0,
  tools_called jsonb NOT NULL DEFAULT '[]'::jsonb,
  risk_level varchar(30) NOT NULL DEFAULT 'READ_ONLY',
  human_approval_status varchar(30),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_agent_runs_org_created_idx ON ai_agent_runs (organization_id, created_at DESC);

-- Permissões para role de aplicação e Políticas de Row-Level Security (RLS)
GRANT USAGE ON SCHEMA public TO al_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO al_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO al_app;

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'memberships',
      'tenant_modules',
      'audit_logs',
      'customers',
      'assets',
      'service_orders',
      'conversations',
      'messages',
      'knowledge_documents',
      'knowledge_chunks',
      'ai_agent_runs'
    ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I', tbl);
    EXECUTE format(
      'CREATE POLICY tenant_isolation_policy ON %I USING (organization_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid) WITH CHECK (organization_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid)',
      tbl
    );
  END LOOP;
END
$$;
