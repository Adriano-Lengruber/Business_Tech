-- AL Business OS — Migration 0003: Estoque, Fornecedores, Compras, PDV e Fiscal (Fase 3)

CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name varchar(180) NOT NULL,
  cnpj varchar(20),
  email varchar(255),
  phone varchar(24),
  lead_time_days integer NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS suppliers_org_idx ON suppliers (organization_id);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sku varchar(60) NOT NULL,
  barcode varchar(60),
  name varchar(180) NOT NULL,
  category varchar(80) NOT NULL DEFAULT 'hardware',
  brand varchar(80),
  unit varchar(16) NOT NULL DEFAULT 'UN',
  cost_cents integer NOT NULL DEFAULT 0,
  price_cents integer NOT NULL DEFAULT 0,
  stock_qty integer NOT NULL DEFAULT 0,
  min_stock_qty integer NOT NULL DEFAULT 2,
  ncm varchar(12),
  cfop_default varchar(8) NOT NULL DEFAULT '5102',
  csosn_default varchar(8) NOT NULL DEFAULT '102',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS products_org_sku_idx ON products (organization_id, sku);
CREATE INDEX IF NOT EXISTS products_org_barcode_idx ON products (organization_id, barcode);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type varchar(24) NOT NULL,
  quantity_delta integer NOT NULL,
  unit_cost_cents integer NOT NULL DEFAULT 0,
  reference_type varchar(40),
  reference_id varchar(120),
  note text,
  actor_id varchar(120) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inv_movements_org_prod_idx
  ON inventory_movements (organization_id, product_id, created_at DESC);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  code varchar(40) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'ORDERED',
  total_cost_cents integer NOT NULL DEFAULT 0,
  notes text,
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS purchase_orders_org_code_idx
  ON purchase_orders (organization_id, code);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL,
  unit_cost_cents integer NOT NULL
);
CREATE INDEX IF NOT EXISTS po_items_po_idx ON purchase_order_items (purchase_order_id);

CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  code varchar(40) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'COMPLETED',
  payment_method varchar(24) NOT NULL DEFAULT 'pix',
  subtotal_cents integer NOT NULL DEFAULT 0,
  discount_cents integer NOT NULL DEFAULT 0,
  total_cents integer NOT NULL DEFAULT 0,
  total_cost_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sales_org_code_idx ON sales (organization_id, code);

CREATE TABLE IF NOT EXISTS sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL,
  unit_cost_cents integer NOT NULL,
  unit_price_cents integer NOT NULL,
  total_price_cents integer NOT NULL
);
CREATE INDEX IF NOT EXISTS sale_items_sale_idx ON sale_items (sale_id);

CREATE TABLE IF NOT EXISTS fiscal_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tax_regime varchar(40) NOT NULL DEFAULT 'SIMPLES_NACIONAL',
  state_uf varchar(2) NOT NULL DEFAULT 'SP',
  city_code varchar(12) NOT NULL DEFAULT '3550308',
  nfe_series integer NOT NULL DEFAULT 1,
  nfce_series integer NOT NULL DEFAULT 1,
  nfse_series integer NOT NULL DEFAULT 1,
  provider_name varchar(40) NOT NULL DEFAULT 'sandbox',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS fiscal_profiles_org_idx ON fiscal_profiles (organization_id);

CREATE TABLE IF NOT EXISTS fiscal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  doc_type varchar(16) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'AUTHORIZED',
  number integer NOT NULL,
  series integer NOT NULL DEFAULT 1,
  access_key varchar(64),
  reference_type varchar(30) NOT NULL,
  reference_id uuid NOT NULL,
  total_cents integer NOT NULL,
  provider_name varchar(40) NOT NULL DEFAULT 'sandbox',
  rejection_reason text,
  ai_diagnostic_hint text,
  xml_url text,
  pdf_url text,
  issued_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fiscal_docs_org_created_idx
  ON fiscal_documents (organization_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON suppliers, products, inventory_movements, purchase_orders, purchase_order_items,
     sales, sale_items, fiscal_profiles, fiscal_documents
  TO al_app;

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'suppliers',
      'products',
      'inventory_movements',
      'purchase_orders',
      'purchase_order_items',
      'sales',
      'sale_items',
      'fiscal_profiles',
      'fiscal_documents'
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
