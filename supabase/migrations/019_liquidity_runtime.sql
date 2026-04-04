-- =============================================================================
-- Migration 019: Liquidity Planning & Interface Execution Engine
-- Tables: project_process_instances, liquidity_event_instances,
--         bank_upload_files, bank_transactions, interface_execution_log
-- Also: company_settings columns for liquidity thresholds
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. project_process_instances — runtime instance of a process per project
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.project_process_instances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id      UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  process_id      UUID NOT NULL REFERENCES public.process_definitions(id) ON DELETE CASCADE,
  process_version TEXT NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'completed', 'cancelled')),
  UNIQUE (project_id, process_id)
);

-- ---------------------------------------------------------------------------
-- 2. liquidity_event_instances — per-project liquidity plan/actual events
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.liquidity_event_instances (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id           UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id           UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  instance_id          UUID NOT NULL REFERENCES public.project_process_instances(id) ON DELETE CASCADE,
  project_id           UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  process_id           UUID NOT NULL REFERENCES public.process_definitions(id) ON DELETE CASCADE,
  step_id              UUID NOT NULL REFERENCES public.process_steps(id) ON DELETE CASCADE,
  process_step_id      TEXT NOT NULL,
  step_name            TEXT NOT NULL,
  marker_type          TEXT NOT NULL CHECK (marker_type IN ('trigger', 'event')),
  linked_instance_id   UUID REFERENCES public.liquidity_event_instances(id) ON DELETE SET NULL,
  direction            TEXT NOT NULL CHECK (direction IN ('income', 'expense')),
  plan_currency        TEXT NOT NULL DEFAULT 'CHF',
  plan_amount          NUMERIC(14,2),
  amount_type          TEXT NOT NULL DEFAULT 'fixed' CHECK (amount_type IN ('fixed', 'percentage')),
  plan_delay_days      INTEGER DEFAULT 0,
  trigger_activated_at TIMESTAMPTZ,
  plan_date            DATE,
  actual_date          DATE,
  actual_currency      TEXT,
  actual_amount        NUMERIC(14,2),
  fx_rate              NUMERIC(14,6),
  fx_rate_date         DATE,
  actual_source        TEXT CHECK (actual_source IS NULL OR actual_source IN ('bexio', 'bank_upload', 'manual', 'connector')),
  actual_source_ref    TEXT,
  matched_at           TIMESTAMPTZ,
  matched_by           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  amount_deviation     NUMERIC(14,2),
  date_deviation_days  INTEGER,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 3. bank_upload_files — uploaded bank statement files
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.bank_upload_files (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id        UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id        UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  filename          TEXT NOT NULL,
  file_format       TEXT NOT NULL CHECK (file_format IN ('camt053', 'mt940', 'csv')),
  storage_path      TEXT NOT NULL,
  period_from       DATE,
  period_to         DATE,
  transaction_count INTEGER,
  processed_at      TIMESTAMPTZ,
  matched_count     INTEGER NOT NULL DEFAULT 0,
  unmatched_count   INTEGER NOT NULL DEFAULT 0,
  uploaded_by       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 4. bank_transactions — parsed individual transactions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id        UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id        UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  upload_id         UUID NOT NULL REFERENCES public.bank_upload_files(id) ON DELETE CASCADE,
  transaction_date  DATE NOT NULL,
  value_date        DATE,
  amount            NUMERIC(14,2) NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'CHF',
  direction         TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
  reference         TEXT,
  counterparty_name TEXT,
  counterparty_iban TEXT,
  description       TEXT,
  matched_to        UUID REFERENCES public.liquidity_event_instances(id) ON DELETE SET NULL,
  match_confidence  NUMERIC(4,3),
  status            TEXT NOT NULL DEFAULT 'unmatched'
                      CHECK (status IN ('unmatched', 'matched', 'ignored'))
);

-- ---------------------------------------------------------------------------
-- 5. interface_execution_log — audit trail for interface executions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.interface_execution_log (
  id              BIGSERIAL PRIMARY KEY,
  holding_id      UUID,
  company_id      UUID,
  interface_id    UUID REFERENCES public.process_step_interfaces(id) ON DELETE SET NULL,
  step_id         UUID,
  process_id      UUID,
  executed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trigger         TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('success', 'error', 'timeout', 'skipped')),
  http_status     INTEGER,
  duration_ms     INTEGER,
  retry_count     INTEGER NOT NULL DEFAULT 0,
  error_message   TEXT,
  error_context   JSONB
);

-- ---------------------------------------------------------------------------
-- 6. company_settings — add liquidity threshold columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS min_liquidity_threshold NUMERIC(14,2) DEFAULT 10000;

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(14,2) DEFAULT 0;

-- =============================================================================
-- updated_at trigger for liquidity_event_instances
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_liquidity_event_instances_updated_at
  ON public.liquidity_event_instances;

CREATE TRIGGER trg_liquidity_event_instances_updated_at
  BEFORE UPDATE ON public.liquidity_event_instances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.project_process_instances  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liquidity_event_instances  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_upload_files          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transactions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interface_execution_log    ENABLE ROW LEVEL SECURITY;

-- ---- Three-tier RLS for project_process_instances, liquidity_event_instances,
--      bank_upload_files, bank_transactions ----

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'project_process_instances',
    'liquidity_event_instances',
    'bank_upload_files',
    'bank_transactions'
  ] LOOP
    -- Enura admin: full access
    EXECUTE format(
      'CREATE POLICY "enura_admin_%s" ON public.%I FOR ALL USING (public.is_enura_admin())',
      tbl, tbl
    );
    -- Holding admin: full access within own holding
    EXECUTE format(
      'CREATE POLICY "holding_admin_%s" ON public.%I FOR ALL USING (holding_id = public.current_holding_id() AND public.is_holding_admin()) WITH CHECK (holding_id = public.current_holding_id() AND public.is_holding_admin())',
      tbl, tbl
    );
    -- Company user: read access within own company
    EXECUTE format(
      'CREATE POLICY "company_user_%s" ON public.%I FOR SELECT USING (company_id = public.current_company_id())',
      tbl, tbl
    );
    -- Service role: full access
    EXECUTE format(
      'CREATE POLICY "service_%s" ON public.%I FOR ALL USING (current_setting(''role'') = ''service_role'') WITH CHECK (current_setting(''role'') = ''service_role'')',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ---- interface_execution_log: holding admin read + enura admin all + append-only ----

CREATE POLICY "enura_admin_interface_execution_log"
  ON public.interface_execution_log FOR ALL
  USING (public.is_enura_admin());

CREATE POLICY "holding_admin_interface_execution_log"
  ON public.interface_execution_log FOR SELECT
  USING (holding_id = public.current_holding_id() AND public.is_holding_admin());

CREATE POLICY "interface_execution_log_insert"
  ON public.interface_execution_log FOR INSERT
  WITH CHECK (true);

CREATE POLICY "service_interface_execution_log"
  ON public.interface_execution_log FOR ALL
  USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');

-- =============================================================================
-- INDEXES
-- =============================================================================

-- project_process_instances
CREATE INDEX IF NOT EXISTS idx_ppi_company_status
  ON public.project_process_instances (company_id, status);

CREATE INDEX IF NOT EXISTS idx_ppi_project
  ON public.project_process_instances (project_id);

-- liquidity_event_instances
CREATE INDEX IF NOT EXISTS idx_lei_company_plan_date
  ON public.liquidity_event_instances (company_id, plan_date);

CREATE INDEX IF NOT EXISTS idx_lei_project
  ON public.liquidity_event_instances (project_id);

CREATE INDEX IF NOT EXISTS idx_lei_instance
  ON public.liquidity_event_instances (instance_id);

CREATE INDEX IF NOT EXISTS idx_lei_overdue
  ON public.liquidity_event_instances (company_id, plan_date)
  WHERE actual_date IS NULL;

-- bank_upload_files
CREATE INDEX IF NOT EXISTS idx_buf_company_uploaded
  ON public.bank_upload_files (company_id, uploaded_at);

-- bank_transactions
CREATE INDEX IF NOT EXISTS idx_bt_company_date
  ON public.bank_transactions (company_id, transaction_date);

CREATE INDEX IF NOT EXISTS idx_bt_status
  ON public.bank_transactions (company_id, status)
  WHERE status = 'unmatched';

CREATE INDEX IF NOT EXISTS idx_bt_upload
  ON public.bank_transactions (upload_id);

-- interface_execution_log
CREATE INDEX IF NOT EXISTS idx_iel_interface
  ON public.interface_execution_log (interface_id, executed_at);

CREATE INDEX IF NOT EXISTS idx_iel_company_date
  ON public.interface_execution_log (company_id, executed_at);

CREATE INDEX IF NOT EXISTS idx_iel_status
  ON public.interface_execution_log (status)
  WHERE status = 'error';
