-- ============================================================
-- Migration 015 — Process Builder
-- Tables for the Enura Platform Process Builder: secrets,
-- tool registry, process templates, definitions, steps,
-- sources, interfaces, liquidity, versions, deployments,
-- and company currency settings.
-- ============================================================

-- ============================================================
-- 1. holding_secrets — holding-level secret metadata
-- ============================================================
CREATE TABLE IF NOT EXISTS public.holding_secrets (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id             UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  name                   TEXT NOT NULL,
  secret_type            TEXT NOT NULL CHECK (secret_type IN ('api_key','oauth2_token','service_account','certificate','password','webhook_secret')),
  scope                  TEXT NOT NULL DEFAULT 'global',
  vault_id               UUID,
  description            TEXT,
  is_active              BOOLEAN NOT NULL DEFAULT TRUE,
  created_by             UUID REFERENCES public.profiles(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_rotated_at        TIMESTAMPTZ,
  rotation_interval_days INTEGER,
  next_rotation_due      DATE,
  UNIQUE (holding_id, name)
);

-- ============================================================
-- 2. secret_access_log — append-only audit trail
-- ============================================================
CREATE TABLE IF NOT EXISTS public.secret_access_log (
  id            BIGSERIAL PRIMARY KEY,
  holding_id    UUID NOT NULL,
  secret_id     UUID NOT NULL REFERENCES public.holding_secrets(id) ON DELETE CASCADE,
  accessed_by   TEXT NOT NULL,
  context       TEXT,
  accessed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. tool_registry — available external tools per holding
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tool_registry (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id           UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  slug                 TEXT NOT NULL,
  category             TEXT NOT NULL CHECK (category IN ('crm','telephony','accounting','calendar','lead_aggregation','messaging','email','storage','analytics','custom')),
  base_url             TEXT,
  auth_type            TEXT NOT NULL CHECK (auth_type IN ('api_key','oauth2','service_account','webhook','none')),
  secret_ref           TEXT,
  default_headers      JSONB NOT NULL DEFAULT '{}'::jsonb,
  interface_templates  JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  icon_url             TEXT,
  docs_url             TEXT,
  created_by           UUID REFERENCES public.profiles(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (holding_id, slug)
);

-- ============================================================
-- 4. process_templates — group-wide reusable templates
-- ============================================================
CREATE TABLE IF NOT EXISTS public.process_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  description  TEXT,
  category     TEXT NOT NULL CHECK (category IN ('sales','operations','finance','hr','support','custom')),
  steps        JSONB NOT NULL DEFAULT '[]'::jsonb,
  version      TEXT NOT NULL DEFAULT '1.0.0',
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_by   UUID REFERENCES public.profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. process_definitions — per holding / company
-- ============================================================
CREATE TABLE IF NOT EXISTS public.process_definitions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id       UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id       UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  template_id      UUID REFERENCES public.process_templates(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  description      TEXT,
  category         TEXT NOT NULL CHECK (category IN ('sales','operations','finance','hr','support','custom')),
  menu_label       TEXT,
  menu_icon        TEXT,
  menu_sort_order  INTEGER DEFAULT 0,
  visible_roles    TEXT[] NOT NULL DEFAULT '{}',
  status           TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','finalised','pending_approval','deployed','archived')),
  version          TEXT NOT NULL DEFAULT '1.0.0',
  deployed_at      TIMESTAMPTZ,
  deployed_version TEXT,
  created_by       UUID REFERENCES public.profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (holding_id, company_id, name)
);

-- ============================================================
-- 6. process_steps — individual steps within a process
-- ============================================================
CREATE TABLE IF NOT EXISTS public.process_steps (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id        UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id        UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  process_id        UUID NOT NULL REFERENCES public.process_definitions(id) ON DELETE CASCADE,
  process_step_id   TEXT NOT NULL,
  name              TEXT NOT NULL,
  main_process      TEXT NOT NULL CHECK (main_process IN ('sales','operations','finance','hr','support','custom')),
  description       TEXT,
  responsible_roles TEXT[] NOT NULL DEFAULT '{}',
  expected_output   TEXT,
  typical_hours     INTEGER,
  warning_days      INTEGER,
  show_in_flowchart BOOLEAN NOT NULL DEFAULT TRUE,
  liquidity_marker  TEXT CHECK (liquidity_marker IS NULL OR liquidity_marker IN ('trigger','event')),
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (process_id, process_step_id)
);

-- ============================================================
-- 7. process_step_sources — data sources for a step
-- ============================================================
CREATE TABLE IF NOT EXISTS public.process_step_sources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id    UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id    UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  process_id    UUID NOT NULL REFERENCES public.process_definitions(id) ON DELETE CASCADE,
  step_id       UUID NOT NULL REFERENCES public.process_steps(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,
  source_type   TEXT NOT NULL CHECK (source_type IN ('api','database','file','manual','webhook','calculated')),
  tool_name     TEXT,
  endpoint      TEXT,
  description   TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- 8. process_step_interfaces — API/integration interfaces
-- ============================================================
CREATE TABLE IF NOT EXISTS public.process_step_interfaces (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id        UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id        UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  process_id        UUID NOT NULL REFERENCES public.process_definitions(id) ON DELETE CASCADE,
  step_id           UUID NOT NULL REFERENCES public.process_steps(id) ON DELETE CASCADE,
  label             TEXT NOT NULL,
  interface_type    TEXT NOT NULL CHECK (interface_type IN ('inbound','outbound','bidirectional')),
  protocol          TEXT NOT NULL CHECK (protocol IN ('rest','graphql','grpc','webhook','file','manual')),
  tool_registry_id  UUID REFERENCES public.tool_registry(id) ON DELETE SET NULL,
  endpoint          TEXT,
  http_method       TEXT CHECK (http_method IS NULL OR http_method IN ('GET','POST','PUT','PATCH','DELETE')),
  request_schema    JSONB,
  response_schema   JSONB,
  field_mapping     JSONB,
  secret_ref        TEXT,
  sync_interval_min INTEGER,
  trigger_condition TEXT,
  retry_policy      TEXT NOT NULL DEFAULT 'exponential_backoff'
                      CHECK (retry_policy IN ('none','fixed','exponential_backoff','linear')),
  timeout_sec       INTEGER DEFAULT 30,
  sort_order        INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- 9. process_step_liquidity — liquidity markers per step
-- ============================================================
CREATE TABLE IF NOT EXISTS public.process_step_liquidity (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id       UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id       UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  process_id       UUID NOT NULL REFERENCES public.process_definitions(id) ON DELETE CASCADE,
  step_id          UUID NOT NULL UNIQUE REFERENCES public.process_steps(id) ON DELETE CASCADE,
  marker_type      TEXT NOT NULL CHECK (marker_type IN ('trigger','event')),
  trigger_step_id  UUID REFERENCES public.process_steps(id),
  event_step_id    UUID REFERENCES public.process_steps(id),
  direction        TEXT NOT NULL CHECK (direction IN ('income','expense')),
  plan_currency    TEXT NOT NULL DEFAULT 'CHF',
  plan_amount      NUMERIC(14,2),
  amount_type      TEXT NOT NULL DEFAULT 'fixed' CHECK (amount_type IN ('fixed','percentage')),
  actual_currency  TEXT,
  fx_rate          NUMERIC,
  fx_rate_date     DATE,
  plan_delay_days  INTEGER DEFAULT 0,
  plan_date        DATE,
  actual_date      DATE,
  actual_amount    NUMERIC(14,2),
  source_tool      TEXT
);

-- ============================================================
-- 10. company_currency_settings — FX configuration per company
-- ============================================================
CREATE TABLE IF NOT EXISTS public.company_currency_settings (
  company_id          UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  holding_id          UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  base_currency       TEXT NOT NULL DEFAULT 'CHF',
  enabled_currencies  TEXT[] NOT NULL DEFAULT ARRAY['CHF','EUR'],
  eur_chf_rate        NUMERIC,
  rate_updated_at     DATE,
  fx_source           TEXT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 11. process_versions — snapshot history
-- ============================================================
CREATE TABLE IF NOT EXISTS public.process_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id      UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  process_id      UUID NOT NULL REFERENCES public.process_definitions(id) ON DELETE CASCADE,
  version         TEXT NOT NULL,
  snapshot        JSONB NOT NULL DEFAULT '{}'::jsonb,
  change_summary  TEXT,
  created_by      UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (process_id, version)
);

-- ============================================================
-- 12. process_deployments — deployment workflow
-- ============================================================
CREATE TABLE IF NOT EXISTS public.process_deployments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id     UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id     UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  process_id     UUID NOT NULL REFERENCES public.process_definitions(id) ON DELETE CASCADE,
  version        TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending_approval'
                   CHECK (status IN ('pending_approval','approved','rejected','deployed','rolled_back')),
  requested_by   UUID REFERENCES public.profiles(id),
  requested_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by    UUID REFERENCES public.profiles(id),
  reviewed_at    TIMESTAMPTZ,
  review_notes   TEXT,
  deployed_at    TIMESTAMPTZ,
  reason         TEXT,
  rollback_of    UUID REFERENCES public.process_deployments(id) ON DELETE SET NULL
);


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.holding_secrets           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secret_access_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_registry             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_templates         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_definitions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_steps             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_step_sources      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_step_interfaces   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_step_liquidity    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_currency_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_versions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_deployments       ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- RLS POLICIES
-- ============================================================

-- ---- holding_secrets: holding admin + enura admin only ----
CREATE POLICY "enura_admin_holding_secrets"
  ON public.holding_secrets FOR ALL
  USING (public.is_enura_admin());

CREATE POLICY "holding_admin_holding_secrets"
  ON public.holding_secrets FOR ALL
  USING (holding_id = public.current_holding_id() AND public.is_holding_admin());


-- ---- secret_access_log: append-only insert, holding admin + enura read ----
CREATE POLICY "secret_access_log_insert"
  ON public.secret_access_log FOR INSERT
  WITH CHECK (true);

CREATE POLICY "enura_admin_secret_access_log"
  ON public.secret_access_log FOR SELECT
  USING (public.is_enura_admin());

CREATE POLICY "holding_admin_secret_access_log"
  ON public.secret_access_log FOR SELECT
  USING (holding_id = public.current_holding_id() AND public.is_holding_admin());


-- ---- tool_registry: holding admin write, company users read active ----
CREATE POLICY "enura_admin_tool_registry"
  ON public.tool_registry FOR ALL
  USING (public.is_enura_admin());

CREATE POLICY "holding_admin_tool_registry"
  ON public.tool_registry FOR ALL
  USING (holding_id = public.current_holding_id() AND public.is_holding_admin());

CREATE POLICY "company_user_tool_registry_read"
  ON public.tool_registry FOR SELECT
  USING (holding_id = public.current_holding_id() AND is_active = TRUE);


-- ---- process_templates: authenticated read, holding admin + enura write ----
CREATE POLICY "authenticated_process_templates_read"
  ON public.process_templates FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "enura_admin_process_templates"
  ON public.process_templates FOR ALL
  USING (public.is_enura_admin());

CREATE POLICY "holding_admin_process_templates"
  ON public.process_templates FOR ALL
  USING (public.is_holding_admin());


-- ---- Process builder tables: holding admin + enura admin write, company user read ----
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'process_definitions','process_steps','process_step_sources',
    'process_step_interfaces','process_step_liquidity',
    'process_versions','process_deployments'
  ] LOOP
    -- Enura admin: full access
    EXECUTE format(
      'CREATE POLICY "enura_admin_%s" ON public.%I FOR ALL USING (public.is_enura_admin())',
      tbl, tbl
    );
    -- Holding admin: full access within own holding
    EXECUTE format(
      'CREATE POLICY "holding_admin_%s" ON public.%I FOR ALL USING (holding_id = public.current_holding_id() AND public.is_holding_admin())',
      tbl, tbl
    );
    -- Company user: read access within own company
    EXECUTE format(
      'CREATE POLICY "company_user_%s" ON public.%I FOR SELECT USING (company_id = public.current_company_id() OR (company_id IS NULL AND holding_id = public.current_holding_id()))',
      tbl, tbl
    );
  END LOOP;
END $$;


-- ---- company_currency_settings: company user + holding admin ----
CREATE POLICY "enura_admin_company_currency_settings"
  ON public.company_currency_settings FOR ALL
  USING (public.is_enura_admin());

CREATE POLICY "holding_admin_company_currency_settings"
  ON public.company_currency_settings FOR ALL
  USING (holding_id = public.current_holding_id() AND public.is_holding_admin());

CREATE POLICY "company_user_company_currency_settings"
  ON public.company_currency_settings FOR ALL
  USING (company_id = public.current_company_id());


-- ============================================================
-- INDEXES
-- ============================================================

-- holding_secrets
CREATE INDEX IF NOT EXISTS idx_holding_secrets_holding_id ON public.holding_secrets(holding_id);
CREATE INDEX IF NOT EXISTS idx_holding_secrets_active ON public.holding_secrets(holding_id, is_active) WHERE is_active = TRUE;

-- secret_access_log
CREATE INDEX IF NOT EXISTS idx_secret_access_log_holding_id ON public.secret_access_log(holding_id);
CREATE INDEX IF NOT EXISTS idx_secret_access_log_secret_id ON public.secret_access_log(secret_id);
CREATE INDEX IF NOT EXISTS idx_secret_access_log_accessed_at ON public.secret_access_log(accessed_at DESC);

-- tool_registry
CREATE INDEX IF NOT EXISTS idx_tool_registry_holding_id ON public.tool_registry(holding_id);
CREATE INDEX IF NOT EXISTS idx_tool_registry_category ON public.tool_registry(holding_id, category);
CREATE INDEX IF NOT EXISTS idx_tool_registry_active ON public.tool_registry(holding_id, is_active) WHERE is_active = TRUE;

-- process_templates
CREATE INDEX IF NOT EXISTS idx_process_templates_category ON public.process_templates(category);
CREATE INDEX IF NOT EXISTS idx_process_templates_active ON public.process_templates(is_active) WHERE is_active = TRUE;

-- process_definitions
CREATE INDEX IF NOT EXISTS idx_process_definitions_holding_id ON public.process_definitions(holding_id);
CREATE INDEX IF NOT EXISTS idx_process_definitions_company_id ON public.process_definitions(company_id);
CREATE INDEX IF NOT EXISTS idx_process_definitions_template_id ON public.process_definitions(template_id);
CREATE INDEX IF NOT EXISTS idx_process_definitions_status ON public.process_definitions(holding_id, status);
CREATE INDEX IF NOT EXISTS idx_process_definitions_category ON public.process_definitions(holding_id, category);

-- process_steps
CREATE INDEX IF NOT EXISTS idx_process_steps_process_id ON public.process_steps(process_id);
CREATE INDEX IF NOT EXISTS idx_process_steps_holding_id ON public.process_steps(holding_id);
CREATE INDEX IF NOT EXISTS idx_process_steps_company_id ON public.process_steps(company_id);
CREATE INDEX IF NOT EXISTS idx_process_steps_sort ON public.process_steps(process_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_process_steps_liquidity ON public.process_steps(process_id) WHERE liquidity_marker IS NOT NULL;

-- process_step_sources
CREATE INDEX IF NOT EXISTS idx_process_step_sources_step_id ON public.process_step_sources(step_id);
CREATE INDEX IF NOT EXISTS idx_process_step_sources_process_id ON public.process_step_sources(process_id);
CREATE INDEX IF NOT EXISTS idx_process_step_sources_holding_id ON public.process_step_sources(holding_id);

-- process_step_interfaces
CREATE INDEX IF NOT EXISTS idx_process_step_interfaces_step_id ON public.process_step_interfaces(step_id);
CREATE INDEX IF NOT EXISTS idx_process_step_interfaces_process_id ON public.process_step_interfaces(process_id);
CREATE INDEX IF NOT EXISTS idx_process_step_interfaces_holding_id ON public.process_step_interfaces(holding_id);
CREATE INDEX IF NOT EXISTS idx_process_step_interfaces_tool_registry_id ON public.process_step_interfaces(tool_registry_id);

-- process_step_liquidity
CREATE INDEX IF NOT EXISTS idx_process_step_liquidity_process_id ON public.process_step_liquidity(process_id);
CREATE INDEX IF NOT EXISTS idx_process_step_liquidity_holding_id ON public.process_step_liquidity(holding_id);
CREATE INDEX IF NOT EXISTS idx_process_step_liquidity_trigger_step ON public.process_step_liquidity(trigger_step_id);
CREATE INDEX IF NOT EXISTS idx_process_step_liquidity_event_step ON public.process_step_liquidity(event_step_id);

-- company_currency_settings
CREATE INDEX IF NOT EXISTS idx_company_currency_settings_holding_id ON public.company_currency_settings(holding_id);

-- process_versions
CREATE INDEX IF NOT EXISTS idx_process_versions_process_id ON public.process_versions(process_id);
CREATE INDEX IF NOT EXISTS idx_process_versions_holding_id ON public.process_versions(holding_id);
CREATE INDEX IF NOT EXISTS idx_process_versions_created_at ON public.process_versions(process_id, created_at DESC);

-- process_deployments
CREATE INDEX IF NOT EXISTS idx_process_deployments_process_id ON public.process_deployments(process_id);
CREATE INDEX IF NOT EXISTS idx_process_deployments_holding_id ON public.process_deployments(holding_id);
CREATE INDEX IF NOT EXISTS idx_process_deployments_company_id ON public.process_deployments(company_id);
CREATE INDEX IF NOT EXISTS idx_process_deployments_status ON public.process_deployments(status);
CREATE INDEX IF NOT EXISTS idx_process_deployments_rollback ON public.process_deployments(rollback_of);


-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS trg_set_updated_at_tool_registry ON public.tool_registry;
CREATE TRIGGER trg_set_updated_at_tool_registry
  BEFORE UPDATE ON public.tool_registry
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_process_definitions ON public.process_definitions;
CREATE TRIGGER trg_set_updated_at_process_definitions
  BEFORE UPDATE ON public.process_definitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_process_steps ON public.process_steps;
CREATE TRIGGER trg_set_updated_at_process_steps
  BEFORE UPDATE ON public.process_steps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_process_templates ON public.process_templates;
CREATE TRIGGER trg_set_updated_at_process_templates
  BEFORE UPDATE ON public.process_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_company_currency_settings ON public.company_currency_settings;
CREATE TRIGGER trg_set_updated_at_company_currency_settings
  BEFORE UPDATE ON public.company_currency_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
