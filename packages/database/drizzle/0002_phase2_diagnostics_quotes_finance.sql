-- AL Business OS — Migration 0002: Diagnósticos, Orçamentos e Financeiro (Fase 2)

CREATE TABLE IF NOT EXISTS os_diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  service_order_id uuid NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  category varchar(60) NOT NULL DEFAULT 'geral',
  observed_facts text NOT NULL,
  tests_performed jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_hypotheses jsonb NOT NULL DEFAULT '[]'::jsonb,
  final_diagnosis text,
  confidence_level varchar(20) NOT NULL DEFAULT 'medium',
  client_explanation text,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS os_diagnostics_org_os_idx
  ON os_diagnostics (organization_id, service_order_id);

CREATE TABLE IF NOT EXISTS quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  service_order_id uuid NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  code varchar(40) NOT NULL,
  tier varchar(20) NOT NULL DEFAULT 'recommended',
  status varchar(20) NOT NULL DEFAULT 'DRAFT',
  warranty_days integer NOT NULL DEFAULT 90,
  valid_until timestamptz NOT NULL,
  payment_terms varchar(240) NOT NULL,
  client_notes text,
  subtotal_cents integer NOT NULL DEFAULT 0,
  discount_cents integer NOT NULL DEFAULT 0,
  total_cents integer NOT NULL DEFAULT 0,
  estimated_cost_cents integer NOT NULL DEFAULT 0,
  accepted_at timestamptz,
  accepted_ip varchar(64),
  accepted_user_agent text,
  acceptance_hash varchar(128),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS quotes_org_code_idx ON quotes (organization_id, code);
CREATE INDEX IF NOT EXISTS quotes_org_os_idx ON quotes (organization_id, service_order_id);

CREATE TABLE IF NOT EXISTS quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  item_type varchar(24) NOT NULL,
  description varchar(240) NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_cost_cents integer NOT NULL DEFAULT 0,
  unit_price_cents integer NOT NULL DEFAULT 0,
  total_price_cents integer NOT NULL DEFAULT 0,
  approved_by_customer boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS quote_items_quote_idx ON quote_items (quote_id);

CREATE TABLE IF NOT EXISTS financial_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  service_order_id uuid REFERENCES service_orders(id) ON DELETE SET NULL,
  quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL,
  type varchar(20) NOT NULL,
  category varchar(80) NOT NULL,
  description varchar(240) NOT NULL,
  payment_method varchar(24) NOT NULL DEFAULT 'pix',
  status varchar(24) NOT NULL DEFAULT 'PENDING',
  amount_cents integer NOT NULL,
  due_date timestamptz NOT NULL,
  paid_at timestamptz,
  gateway_provider varchar(40),
  gateway_charge_id varchar(140),
  pix_copy_paste text,
  invoice_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fin_tx_org_status_due_idx
  ON financial_transactions (organization_id, status, due_date);
CREATE UNIQUE INDEX IF NOT EXISTS fin_tx_org_gateway_charge_idx
  ON financial_transactions (organization_id, gateway_charge_id);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON os_diagnostics, quotes, quote_items, financial_transactions
  TO al_app;

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'os_diagnostics',
      'quotes',
      'quote_items',
      'financial_transactions'
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
