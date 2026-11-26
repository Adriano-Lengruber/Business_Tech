-- AL Business OS — Migration 0001: Anexos S3 e Eventos de Ordem de Serviço (Fase 1)

CREATE TABLE IF NOT EXISTS service_order_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  service_order_id uuid NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  kind varchar(30) NOT NULL DEFAULT 'intake_photo',
  filename varchar(255) NOT NULL,
  mime_type varchar(120) NOT NULL,
  storage_key text NOT NULL,
  size_bytes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS os_attachments_org_os_idx
  ON service_order_attachments (organization_id, service_order_id);

CREATE TABLE IF NOT EXISTS service_order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  service_order_id uuid NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  event_type varchar(60) NOT NULL,
  from_status varchar(40),
  to_status varchar(40),
  note text,
  actor_type varchar(30) NOT NULL DEFAULT 'human',
  actor_id varchar(120) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS os_events_org_os_created_idx
  ON service_order_events (organization_id, service_order_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON service_order_attachments, service_order_events TO al_app;

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'service_order_attachments',
      'service_order_events'
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
