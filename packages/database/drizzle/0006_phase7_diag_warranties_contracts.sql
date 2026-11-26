-- AL Business OS — Migration 0006: Snapshots Hardware Antes/Depois, Garantias/RMA & Contratos B2B SLA

CREATE TABLE IF NOT EXISTS hardware_diagnostic_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  service_order_id uuid NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
  stage varchar(16) NOT NULL DEFAULT 'BEFORE',
  source varchar(32) NOT NULL DEFAULT 'manual',
  cpu_model varchar(160),
  ram_gb integer,
  storage_summary varchar(180),
  smart_health_pct integer,
  battery_health_pct integer,
  os_version varchar(140),
  cpu_temp_celsius integer,
  notes text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  captured_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hw_snapshots_org_os_idx ON hardware_diagnostic_snapshots (organization_id, service_order_id);

CREATE TABLE IF NOT EXISTS warranty_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  service_order_id uuid NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  code varchar(40) NOT NULL,
  kind varchar(24) NOT NULL DEFAULT 'service',
  status varchar(24) NOT NULL DEFAULT 'ACTIVE',
  warranty_days integer NOT NULL DEFAULT 90,
  expires_at timestamptz NOT NULL,
  supplier_name varchar(160),
  part_description varchar(200),
  notes text,
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS warranty_cases_org_code_idx ON warranty_cases (organization_id, code);
CREATE INDEX IF NOT EXISTS warranty_cases_org_os_idx ON warranty_cases (organization_id, service_order_id);

CREATE TABLE IF NOT EXISTS maintenance_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  code varchar(40) NOT NULL,
  title varchar(180) NOT NULL,
  plan_tier varchar(30) NOT NULL DEFAULT 'preventive',
  status varchar(24) NOT NULL DEFAULT 'ACTIVE',
  monthly_price_cents integer NOT NULL,
  included_hours integer NOT NULL DEFAULT 8,
  used_hours integer NOT NULL DEFAULT 0,
  sla_response_hours integer NOT NULL DEFAULT 4,
  covered_assets_count integer NOT NULL DEFAULT 5,
  preventive_frequency_days integer NOT NULL DEFAULT 90,
  next_preventive_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS maintenance_contracts_org_code_idx ON maintenance_contracts (organization_id, code);
CREATE INDEX IF NOT EXISTS maintenance_contracts_org_status_idx ON maintenance_contracts (organization_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON hardware_diagnostic_snapshots, warranty_cases, maintenance_contracts
  TO al_app;

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'hardware_diagnostic_snapshots',
      'warranty_cases',
      'maintenance_contracts'
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
