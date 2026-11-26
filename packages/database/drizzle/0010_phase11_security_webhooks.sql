-- AL Business OS — Migration 0010: API Keys & Outbound Signed Webhooks (RLS)

CREATE TABLE IF NOT EXISTS tenant_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name varchar(140) NOT NULL,
  key_prefix varchar(24) NOT NULL,
  key_hash varchar(128) NOT NULL,
  scopes jsonb NOT NULL DEFAULT '["os:read"]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS tenant_api_keys_hash_idx ON tenant_api_keys (key_hash);
CREATE INDEX IF NOT EXISTS tenant_api_keys_org_idx ON tenant_api_keys (organization_id);

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name varchar(140) NOT NULL,
  target_url text NOT NULL,
  events jsonb NOT NULL DEFAULT '["service_order.created","quote.approved"]'::jsonb,
  secret_encrypted text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_status_code integer,
  last_delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS webhook_endpoints_org_idx ON webhook_endpoints (organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON tenant_api_keys, webhook_endpoints
  TO al_app;

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY['tenant_api_keys', 'webhook_endpoints'])
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
