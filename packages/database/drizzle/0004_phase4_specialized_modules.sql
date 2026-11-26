-- AL Business OS — Migration 0004: Impressão 3D, Projetos/Dev e Social Media + Leads (Fase 4)

CREATE TABLE IF NOT EXISTS filaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL,
  material_type varchar(24) NOT NULL DEFAULT 'PLA',
  color varchar(60) NOT NULL,
  brand varchar(80),
  cost_per_kg_cents integer NOT NULL,
  stock_grams integer NOT NULL DEFAULT 1000,
  min_grams integer NOT NULL DEFAULT 250,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS filaments_org_idx ON filaments (organization_id);

CREATE TABLE IF NOT EXISTS print_3d_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  filament_id uuid NOT NULL REFERENCES filaments(id) ON DELETE RESTRICT,
  code varchar(40) NOT NULL,
  model_name varchar(180) NOT NULL,
  stl_storage_key text,
  status varchar(30) NOT NULL DEFAULT 'QUEUED',
  weight_grams integer NOT NULL,
  print_time_minutes integer NOT NULL,
  total_cost_cents integer NOT NULL,
  sale_price_cents integer NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS print_3d_jobs_org_code_idx ON print_3d_jobs (organization_id, code);
CREATE INDEX IF NOT EXISTS print_3d_jobs_org_status_idx ON print_3d_jobs (organization_id, status);

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  code varchar(40) NOT NULL,
  title varchar(180) NOT NULL,
  project_type varchar(40) NOT NULL DEFAULT 'software_dev',
  status varchar(24) NOT NULL DEFAULT 'ACTIVE',
  budget_cents integer NOT NULL DEFAULT 0,
  retainer_minutes_monthly integer NOT NULL DEFAULT 0,
  hourly_rate_cents integer NOT NULL DEFAULT 15000,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS projects_org_code_idx ON projects (organization_id, code);

CREATE TABLE IF NOT EXISTS project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title varchar(180) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'BACKLOG',
  priority varchar(20) NOT NULL DEFAULT 'NORMAL',
  estimated_minutes integer NOT NULL DEFAULT 60,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_tasks_proj_idx ON project_tasks (project_id);

CREATE TABLE IF NOT EXISTS project_time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES project_tasks(id) ON DELETE SET NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  minutes integer NOT NULL,
  description varchar(300) NOT NULL,
  billable boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_time_proj_idx ON project_time_entries (project_id);

CREATE TABLE IF NOT EXISTS social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  platform varchar(30) NOT NULL DEFAULT 'instagram',
  status varchar(30) NOT NULL DEFAULT 'DRAFT',
  title varchar(160) NOT NULL,
  caption text NOT NULL,
  hashtags text,
  scheduled_for timestamptz,
  published_at timestamptz,
  external_post_id varchar(140),
  impressions integer NOT NULL DEFAULT 0,
  likes integer NOT NULL DEFAULT 0,
  comments_count integer NOT NULL DEFAULT 0,
  leads_generated integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS social_posts_org_idx ON social_posts (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source varchar(40) NOT NULL DEFAULT 'landing_page',
  source_ref_id varchar(120),
  name varchar(160) NOT NULL,
  phone_e164 varchar(24),
  notes text,
  stage varchar(30) NOT NULL DEFAULT 'NEW',
  ai_score integer NOT NULL DEFAULT 50,
  converted_customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS leads_org_stage_idx ON leads (organization_id, stage);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON filaments, print_3d_jobs, projects, project_tasks, project_time_entries, social_posts, leads
  TO al_app;

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'filaments',
      'print_3d_jobs',
      'projects',
      'project_tasks',
      'project_time_entries',
      'social_posts',
      'leads'
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
