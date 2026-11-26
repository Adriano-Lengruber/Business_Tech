-- AL Business OS — Migration 0011: Produtos Ricos (Foto S3, Tabelas de Preço, Descrição), Fornecedores B2B e Vínculo M:N

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS payment_terms varchar(120),
  ADD COLUMN IF NOT EXISTS accepts_mei boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS image_storage_key text,
  ADD COLUMN IF NOT EXISTS wholesale_price_cents integer,
  ADD COLUMN IF NOT EXISTS vip_price_cents integer,
  ADD COLUMN IF NOT EXISTS warranty_days integer NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS preferred_supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS product_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  supplier_sku varchar(80),
  last_cost_cents integer NOT NULL DEFAULT 0,
  supplier_url text,
  notes text,
  is_preferred boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS product_suppliers_prod_sup_idx
  ON product_suppliers (product_id, supplier_id);
CREATE INDEX IF NOT EXISTS product_suppliers_org_idx
  ON product_suppliers (organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON product_suppliers TO al_app;

ALTER TABLE product_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_suppliers FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON product_suppliers;
CREATE POLICY tenant_isolation_policy ON product_suppliers
  USING (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
