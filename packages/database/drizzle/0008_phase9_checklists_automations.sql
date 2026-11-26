-- AL Business OS — Migration 0008: Checklists por Categoria (bloqueio) & Motor de Regras/Automações

CREATE TABLE IF NOT EXISTS checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category varchar(60) NOT NULL DEFAULT 'notebook',
  title varchar(160) NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  block_closing_if_incomplete boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS checklist_templates_org_cat_idx ON checklist_templates (organization_id, category);

CREATE TABLE IF NOT EXISTS service_order_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  service_order_id uuid NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  template_id uuid REFERENCES checklist_templates(id) ON DELETE SET NULL,
  title varchar(160) NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  responses jsonb NOT NULL DEFAULT '{}'::jsonb,
  block_closing_if_incomplete boolean NOT NULL DEFAULT true,
  completed_required boolean NOT NULL DEFAULT false,
  updated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS os_checklists_org_os_idx ON service_order_checklists (organization_id, service_order_id);

CREATE TABLE IF NOT EXISTS automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name varchar(160) NOT NULL,
  trigger_event varchar(60) NOT NULL,
  channel varchar(30) NOT NULL DEFAULT 'internal_alert',
  delay_hours integer NOT NULL DEFAULT 48,
  template_text text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  run_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS automation_rules_org_trigger_idx ON automation_rules (organization_id, trigger_event);

CREATE TABLE IF NOT EXISTS automation_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rule_id uuid NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  target_entity_type varchar(40) NOT NULL,
  target_entity_id varchar(120) NOT NULL,
  target_label varchar(200) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'EXECUTED',
  summary text NOT NULL,
  executed_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS automation_exec_idempotent_idx ON automation_executions (organization_id, rule_id, target_entity_type, target_entity_id);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON checklist_templates, service_order_checklists, automation_rules, automation_executions
  TO al_app;

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'checklist_templates',
      'service_order_checklists',
      'automation_rules',
      'automation_executions'
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
