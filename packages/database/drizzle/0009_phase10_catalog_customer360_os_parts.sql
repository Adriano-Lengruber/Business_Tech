-- AL Business OS — Migration 0009: Catálogo de Serviços Padronizados & PO vinculado à OS

ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "linked_service_order_id" uuid REFERENCES service_orders(id) ON DELETE SET NULL;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "expected_arrival_at" timestamptz;

CREATE TABLE IF NOT EXISTS service_catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code varchar(40) NOT NULL,
  name varchar(180) NOT NULL,
  category varchar(60) NOT NULL DEFAULT 'manutencao',
  default_labor_cents integer NOT NULL DEFAULT 0,
  estimated_cost_cents integer NOT NULL DEFAULT 0,
  default_warranty_days integer NOT NULL DEFAULT 90,
  estimated_hours integer NOT NULL DEFAULT 2,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS service_catalog_org_code_idx ON service_catalog_items (organization_id, code);

GRANT SELECT, INSERT, UPDATE, DELETE ON service_catalog_items TO al_app;

ALTER TABLE service_catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_catalog_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON service_catalog_items;
CREATE POLICY tenant_isolation_policy ON service_catalog_items
  USING (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
