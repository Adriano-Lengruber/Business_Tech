-- AL Business OS — Migration 0007: VIP Store Assets, OS Signature & Timers, Sourcing B2B vs Marketplace PF

ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "acquired_from_store" boolean NOT NULL DEFAULT false;
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "purchased_at" timestamptz;
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "store_sale_ref" varchar(80);
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "vip_discount_pct" integer NOT NULL DEFAULT 0;

ALTER TABLE "service_orders" ADD COLUMN IF NOT EXISTS "signature_data_url" text;
ALTER TABLE "service_orders" ADD COLUMN IF NOT EXISTS "signature_signed_at" timestamptz;

CREATE TABLE IF NOT EXISTS service_order_time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  service_order_id uuid NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  mode varchar(24) NOT NULL DEFAULT 'active_bench',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer NOT NULL DEFAULT 0,
  note varchar(300),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS os_time_entries_org_os_idx ON service_order_time_entries (organization_id, service_order_id);

CREATE TABLE IF NOT EXISTS sourcing_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code varchar(40) NOT NULL,
  item_name varchar(200) NOT NULL,
  category varchar(60) NOT NULL DEFAULT 'hardware',
  desired_qty integer NOT NULL DEFAULT 1,
  target_resale_price_cents integer,
  urgency varchar(20) NOT NULL DEFAULT 'normal',
  status varchar(24) NOT NULL DEFAULT 'OPEN',
  selected_offer_id uuid,
  ai_recommendation text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sourcing_requests_org_code_idx ON sourcing_requests (organization_id, code);
CREATE INDEX IF NOT EXISTS sourcing_requests_org_status_idx ON sourcing_requests (organization_id, status);

CREATE TABLE IF NOT EXISTS sourcing_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES sourcing_requests(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  channel_type varchar(24) NOT NULL DEFAULT 'supplier_b2b',
  vendor_name varchar(160) NOT NULL,
  unit_price_cents integer NOT NULL,
  shipping_cents integer NOT NULL DEFAULT 0,
  tax_or_fee_cents integer NOT NULL DEFAULT 0,
  landed_unit_cost_cents integer NOT NULL,
  delivery_days integer NOT NULL DEFAULT 3,
  payment_terms varchar(120),
  source_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sourcing_offers_org_req_idx ON sourcing_offers (organization_id, request_id);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON service_order_time_entries, sourcing_requests, sourcing_offers
  TO al_app;

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'service_order_time_entries',
      'sourcing_requests',
      'sourcing_offers'
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
