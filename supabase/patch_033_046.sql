-- Enura Platform: Migrations 033-046 (patch run)
-- Migration 033 bug fixed: process_kpi_values has no holding_id column


-- ====== 033_process_house.sql ======
-- 033_process_house.sql
-- Process House: M/P/S classification, ranking, and KPI system

BEGIN;

-- 1. Add process_type and house_sort_order to process_definitions
ALTER TABLE public.process_definitions
  ADD COLUMN IF NOT EXISTS process_type TEXT CHECK (process_type IS NULL OR process_type IN ('M', 'P', 'S')),
  ADD COLUMN IF NOT EXISTS house_sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_process_definitions_house
  ON public.process_definitions (company_id, process_type, house_sort_order)
  WHERE process_type IS NOT NULL;

-- 2. Process KPI definitions (designed by super-user)
CREATE TABLE IF NOT EXISTS public.process_kpi_definitions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id          UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id          UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  process_id          UUID NOT NULL REFERENCES public.process_definitions(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  description         TEXT,
  unit                TEXT NOT NULL DEFAULT '',
  target_value        NUMERIC(14,2),
  warning_threshold   NUMERIC(14,2),
  critical_threshold  NUMERIC(14,2),
  data_source         TEXT,
  visible_roles       TEXT[] NOT NULL DEFAULT '{}',
  sort_order          INTEGER DEFAULT 0,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_by          UUID REFERENCES public.profiles(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (process_id, name)
);

-- 3. Process KPI values (time-series data)
CREATE TABLE IF NOT EXISTS public.process_kpi_values (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id          UUID NOT NULL REFERENCES public.process_kpi_definitions(id) ON DELETE CASCADE,
  period_date     DATE NOT NULL,
  value           NUMERIC(14,2),
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (kpi_id, period_date)
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_process_kpi_defs_process
  ON public.process_kpi_definitions (process_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_process_kpi_defs_company
  ON public.process_kpi_definitions (company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_process_kpi_values_kpi
  ON public.process_kpi_values (kpi_id, period_date DESC);

-- 5. RLS
ALTER TABLE public.process_kpi_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_kpi_values ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE tbl TEXT;
BEGIN
  -- enura admin policy applies to both tables
  FOR tbl IN SELECT unnest(ARRAY['process_kpi_definitions', 'process_kpi_values']) LOOP
    EXECUTE format(
      'CREATE POLICY "enura_%s" ON public.%I FOR ALL USING (public.is_enura_admin())', tbl, tbl);
  END LOOP;

  -- holding_id only exists on process_kpi_definitions, not on process_kpi_values
  EXECUTE 'CREATE POLICY "holding_process_kpi_definitions" ON public.process_kpi_definitions
    FOR ALL USING (holding_id = public.current_holding_id() AND public.is_holding_admin())';

  -- For process_kpi_values: resolve holding via parent definition
  EXECUTE 'CREATE POLICY "holding_process_kpi_values" ON public.process_kpi_values
    FOR ALL USING (EXISTS (
      SELECT 1 FROM public.process_kpi_definitions d
      WHERE d.id = kpi_id
        AND d.holding_id = public.current_holding_id()
        AND public.is_holding_admin()
    ))';
END $$;

-- KPI definitions: company users with process access can read
CREATE POLICY "company_read_kpi_defs" ON public.process_kpi_definitions FOR SELECT
  USING (company_id = public.current_company_id());

-- KPI values: readable if user can read the parent definition
CREATE POLICY "company_read_kpi_values" ON public.process_kpi_values FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.process_kpi_definitions d
    WHERE d.id = process_kpi_values.kpi_id
    AND d.company_id = public.current_company_id()
  ));

-- 6. Updated_at trigger
CREATE TRIGGER trg_process_kpi_defs_updated
  BEFORE UPDATE ON public.process_kpi_definitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;


-- ====== 034_process_phases.sql ======
-- 034_process_phases.sql
-- Aggregation layer: group process steps into phases with phase-level KPIs

-- 1. Process phases table
CREATE TABLE IF NOT EXISTS public.process_phases (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id       UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id       UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  process_id       UUID NOT NULL REFERENCES public.process_definitions(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  description      TEXT,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  color            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (process_id, name)
);

-- 2. Add phase_id to process_steps
ALTER TABLE public.process_steps
  ADD COLUMN IF NOT EXISTS phase_id UUID REFERENCES public.process_phases(id) ON DELETE SET NULL;

-- 3. Add phase_id to process_kpi_definitions
ALTER TABLE public.process_kpi_definitions
  ADD COLUMN IF NOT EXISTS phase_id UUID REFERENCES public.process_phases(id) ON DELETE CASCADE;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_process_phases_process
  ON public.process_phases (process_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_process_steps_phase
  ON public.process_steps (phase_id) WHERE phase_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_process_kpi_defs_phase
  ON public.process_kpi_definitions (phase_id) WHERE phase_id IS NOT NULL;

-- 5. RLS (same pattern as process_steps)
ALTER TABLE public.process_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "enura_admin_process_phases" ON public.process_phases FOR ALL
  USING (public.is_enura_admin());
CREATE POLICY "holding_admin_process_phases" ON public.process_phases FOR ALL
  USING (holding_id = public.current_holding_id() AND public.is_holding_admin());
CREATE POLICY "company_user_process_phases" ON public.process_phases FOR SELECT
  USING (company_id = public.current_company_id()
         OR (company_id IS NULL AND holding_id = public.current_holding_id()));

-- 6. Updated_at trigger
CREATE TRIGGER trg_process_phases_updated
  BEFORE UPDATE ON public.process_phases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ====== 035_step_criticality_rhythm.sql ======
-- 035: Add criticality and rhythm fields to process_steps
ALTER TABLE public.process_steps
  ADD COLUMN IF NOT EXISTS criticality TEXT CHECK (criticality IS NULL OR criticality IN ('A', 'B', 'C')),
  ADD COLUMN IF NOT EXISTS rhythm TEXT;


-- ====== 036_project_documents.sql ======
-- 036: Project documents table for attachments (photos, drawings, invoices, etc.)

CREATE TABLE IF NOT EXISTS public.project_documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id       UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id       UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id       UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  document_type    TEXT NOT NULL CHECK (document_type IN (
    'voice_note', 'email', 'drawing', 'photo', 'video',
    'invoice_customer', 'invoice_supplier', 'contract', 'offer', 'report', 'other'
  )),
  title            TEXT NOT NULL,
  description      TEXT,
  storage_path     TEXT NOT NULL,
  filename         TEXT,
  mime_type        TEXT,
  file_size        INTEGER,
  uploaded_by      UUID REFERENCES public.profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_documents_project
  ON public.project_documents (project_id, document_type);

ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "enura_project_documents" ON public.project_documents FOR ALL
  USING (public.is_enura_admin());
CREATE POLICY "holding_project_documents" ON public.project_documents FOR ALL
  USING (holding_id = public.current_holding_id() AND public.is_holding_admin());
CREATE POLICY "company_project_documents" ON public.project_documents FOR ALL
  USING (company_id = public.current_company_id());


-- ====== 037_extend_projects.sql ======
-- 037: Add description, value, size, and start date to projects

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS project_value NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS system_size_kwp NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS project_start_date DATE;


-- ====== 038_seed_payment_runs.sql ======
-- 038: Seed payment runs from existing invoices with status 'in_payment_run'
-- Groups invoices by company and creates one payment run per company.

DO $$
DECLARE
  rec RECORD;
  run_id UUID;
  admin_id UUID;
BEGIN
  FOR rec IN
    SELECT DISTINCT i.company_id, i.holding_id
    FROM public.invoices_incoming i
    WHERE i.status = 'in_payment_run'
  LOOP
    -- Pick any profile in this company as the creator
    SELECT p.id INTO admin_id
    FROM public.profiles p
    WHERE p.company_id = rec.company_id
    LIMIT 1;

    IF admin_id IS NULL THEN CONTINUE; END IF;

    run_id := gen_random_uuid();

    INSERT INTO public.payment_runs (
      id, holding_id, company_id, run_date, name,
      created_by, total_amount, item_count, currency, status,
      submitted_at, submitted_by
    )
    SELECT
      run_id,
      rec.holding_id,
      rec.company_id,
      CURRENT_DATE,
      'Zahlungslauf ' || TO_CHAR(CURRENT_DATE, 'DD.MM.YYYY'),
      admin_id,
      COALESCE(SUM(i.gross_amount), 0),
      COUNT(*)::INTEGER,
      'CHF',
      'submitted',
      NOW(),
      admin_id
    FROM public.invoices_incoming i
    WHERE i.company_id = rec.company_id
      AND i.status = 'in_payment_run';

    -- Create payment run items
    INSERT INTO public.payment_run_items (
      run_id, holding_id, company_id, invoice_id,
      creditor_name, creditor_iban, amount, currency, sort_order
    )
    SELECT
      run_id,
      rec.holding_id,
      rec.company_id,
      i.id,
      COALESCE(i.sender_name, 'Unbekannt'),
      'CH00 0000 0000 0000 0000 0',
      COALESCE(i.gross_amount, 0),
      COALESCE(i.currency, 'CHF'),
      ROW_NUMBER() OVER (ORDER BY i.due_date)::INTEGER
    FROM public.invoices_incoming i
    WHERE i.company_id = rec.company_id
      AND i.status = 'in_payment_run';
  END LOOP;
END $$;


-- ====== 039_planned_payment_date.sql ======
-- 039: Add planned_payment_date to invoices_incoming
-- This stores the forecasted payment date set by the cash-out planner.
-- due_date remains the supplier's original payment term.

ALTER TABLE public.invoices_incoming
  ADD COLUMN IF NOT EXISTS planned_payment_date DATE;

-- Backfill: set planned_payment_date = due_date for scheduled invoices
UPDATE public.invoices_incoming
SET planned_payment_date = due_date
WHERE status IN ('scheduled', 'in_payment_run', 'paid')
  AND planned_payment_date IS NULL;


-- ====== 040_link_calls_to_projects.sql ======
-- 040: Link calls and calendar_events to projects/leads
-- Enables project-level communication tracking for Setter and Berater tabs

BEGIN;

-- 1. Add project_id and lead_id to calls
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id),
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id);

CREATE INDEX IF NOT EXISTS idx_calls_project ON public.calls (project_id)
  WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_lead ON public.calls (lead_id)
  WHERE lead_id IS NOT NULL;

-- 2. Add project_id and lead_id to calendar_events
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id),
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id);

CREATE INDEX IF NOT EXISTS idx_calendar_events_project ON public.calendar_events (project_id)
  WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_lead ON public.calendar_events (lead_id)
  WHERE lead_id IS NOT NULL;

-- 3. Backfill: Match calls to leads via phone number, then to projects via lead_id
UPDATE public.calls c
SET lead_id = l.id,
    project_id = p.id
FROM public.leads l
LEFT JOIN public.projects p ON p.lead_id = l.id AND p.company_id = l.company_id
WHERE (c.caller_number = l.phone OR c.callee_number = l.phone)
  AND c.company_id = l.company_id
  AND c.lead_id IS NULL
  AND l.phone IS NOT NULL
  AND l.phone != '';

-- 4. Backfill: Match calendar_events to leads/projects via team_member_id
-- Calendar events don't have phone numbers, so match via the berater/setter assignment
UPDATE public.calendar_events ce
SET project_id = p.id,
    lead_id = p.lead_id
FROM public.projects p
WHERE p.berater_id = ce.team_member_id
  AND p.company_id = ce.company_id
  AND p.status = 'active'
  AND ce.project_id IS NULL;

COMMIT;


-- ====== 041_project_current_step.sql ======
-- 041: Add current process step tracking to projects
-- Stores the current Kanban step for each project

BEGIN;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS current_step_id UUID REFERENCES public.process_steps(id),
  ADD COLUMN IF NOT EXISTS current_step_name TEXT;

CREATE INDEX IF NOT EXISTS idx_projects_current_step ON public.projects (current_step_id)
  WHERE current_step_id IS NOT NULL;

-- Backfill: Assign each project a step based on its age across the process steps
-- This mirrors the API logic that distributes projects by age
DO $$
DECLARE
  comp RECORD;
  proc RECORD;
  step_arr UUID[];
  step_names TEXT[];
  step_count INTEGER;
  proj RECORD;
  ages NUMERIC[];
  min_age NUMERIC;
  max_age NUMERIC;
  age_span NUMERIC;
  age_days NUMERIC;
  normalized NUMERIC;
  step_idx INTEGER;
BEGIN
  -- For each company
  FOR comp IN SELECT DISTINCT company_id FROM public.projects WHERE status = 'active' LOOP
    -- For each deployed P-type process in this company
    FOR proc IN
      SELECT pd.id
      FROM public.process_definitions pd
      WHERE pd.company_id = comp.company_id
        AND pd.status = 'deployed'
        AND pd.process_type = 'P'
      ORDER BY pd.house_sort_order
      LIMIT 1  -- Use the first P-process (main value chain)
    LOOP
      -- Get ordered steps
      SELECT array_agg(ps.id ORDER BY ps.sort_order),
             array_agg(ps.name ORDER BY ps.sort_order)
      INTO step_arr, step_names
      FROM public.process_steps ps
      WHERE ps.process_id = proc.id;

      step_count := coalesce(array_length(step_arr, 1), 0);
      IF step_count = 0 THEN CONTINUE; END IF;

      -- Calculate age range
      SELECT MIN(EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 86400),
             MAX(EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 86400)
      INTO min_age, max_age
      FROM public.projects p
      WHERE p.company_id = comp.company_id AND p.status = 'active';

      age_span := GREATEST(max_age - min_age, 1);

      -- Assign each project
      FOR proj IN
        SELECT id, created_at
        FROM public.projects
        WHERE company_id = comp.company_id AND status = 'active'
      LOOP
        age_days := EXTRACT(EPOCH FROM (NOW() - proj.created_at)) / 86400;
        normalized := (age_days - min_age) / age_span;
        step_idx := LEAST(step_count, GREATEST(1, FLOOR(normalized * step_count) + 1));

        UPDATE public.projects
        SET current_step_id = step_arr[step_idx],
            current_step_name = step_names[step_idx]
        WHERE id = proj.id;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

COMMIT;


-- ====== 042_inverter_heatpump.sql ======
-- 042: Add inverter and heatpump size to projects

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS inverter_size_kw NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS heatpump_size_kw NUMERIC(8,2);

-- Backfill seed data with realistic values
-- ~70% of projects get an inverter (sized to match PV), ~30% get a heatpump
UPDATE public.projects
SET inverter_size_kw = ROUND((system_size_kwp * (0.8 + random() * 0.4))::NUMERIC, 1)
WHERE system_size_kwp IS NOT NULL
  AND inverter_size_kw IS NULL;

UPDATE public.projects
SET heatpump_size_kw = ROUND((5 + random() * 15)::NUMERIC, 1)
WHERE system_size_kwp IS NOT NULL
  AND heatpump_size_kw IS NULL
  AND random() < 0.3;


-- ====== 043_step_kpi_snapshots.sql ======
-- 043: Step KPI snapshots for month-over-month comparison
-- Stores daily project counts and portfolio values per process step

CREATE TABLE IF NOT EXISTS public.step_kpi_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES public.process_steps(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  project_count INTEGER NOT NULL DEFAULT 0,
  portfolio_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (step_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_step_kpi_snapshots_company_date
  ON public.step_kpi_snapshots (company_id, snapshot_date);

ALTER TABLE public.step_kpi_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "step_kpi_enura" ON public.step_kpi_snapshots FOR ALL
  USING (public.is_enura_admin());
CREATE POLICY "step_kpi_holding" ON public.step_kpi_snapshots FOR ALL
  USING (public.is_holding_admin());
CREATE POLICY "step_kpi_company" ON public.step_kpi_snapshots FOR SELECT
  USING (company_id = public.current_company_id());

-- Backfill: create a snapshot for today based on current project distribution
INSERT INTO public.step_kpi_snapshots (company_id, step_id, snapshot_date, project_count, portfolio_value)
SELECT
  p.company_id,
  p.current_step_id,
  CURRENT_DATE,
  COUNT(*)::INTEGER,
  COALESCE(SUM(p.project_value), 0)
FROM public.projects p
WHERE p.status = 'active'
  AND p.current_step_id IS NOT NULL
GROUP BY p.company_id, p.current_step_id
ON CONFLICT (step_id, snapshot_date) DO UPDATE
  SET project_count = EXCLUDED.project_count,
      portfolio_value = EXCLUDED.portfolio_value;

-- Also create a "last month" snapshot (30 days ago) with slightly different values
-- to enable trend comparison from the start
INSERT INTO public.step_kpi_snapshots (company_id, step_id, snapshot_date, project_count, portfolio_value)
SELECT
  company_id,
  step_id,
  CURRENT_DATE - INTERVAL '30 days',
  GREATEST(project_count + (CASE WHEN random() > 0.5 THEN -1 ELSE 1 END) * FLOOR(random() * 3)::INTEGER, 0),
  GREATEST(portfolio_value * (0.85 + random() * 0.3), 0)
FROM public.step_kpi_snapshots
WHERE snapshot_date = CURRENT_DATE
ON CONFLICT (step_id, snapshot_date) DO NOTHING;


-- ====== 044_redistribute_projects.sql ======
-- 044: Redistribute seeded projects across P1, P2, P3 process steps
-- Currently 104/123 projects sit in A-01 (first step of P1).
-- Realistically, projects should be distributed across the full value chain.

DO $$
DECLARE
  comp_id UUID := '700a1760-6ba7-4dd7-9e11-6c3a304fab8f';
  p1_id UUID;
  p2_id UUID;
  p3_id UUID;
  p1_steps UUID[];
  p1_names TEXT[];
  p2_steps UUID[];
  p2_names TEXT[];
  p3_steps UUID[];
  p3_names TEXT[];
  total_steps INTEGER;
  proj RECORD;
  proj_count INTEGER;
  proj_idx INTEGER := 0;
  step_idx INTEGER;
  target_step UUID;
  target_name TEXT;
BEGIN
  -- Get P-process IDs (ordered by house_sort_order)
  SELECT id INTO p1_id FROM process_definitions
    WHERE company_id = comp_id AND process_type = 'P' AND house_sort_order = 0;
  SELECT id INTO p2_id FROM process_definitions
    WHERE company_id = comp_id AND process_type = 'P' AND house_sort_order = 1;
  SELECT id INTO p3_id FROM process_definitions
    WHERE company_id = comp_id AND process_type = 'P' AND house_sort_order = 2;

  IF p1_id IS NULL OR p2_id IS NULL OR p3_id IS NULL THEN
    RAISE NOTICE 'Not all 3 P-processes found, skipping';
    RETURN;
  END IF;

  -- Get steps for each process
  SELECT array_agg(id ORDER BY sort_order), array_agg(name ORDER BY sort_order)
  INTO p1_steps, p1_names FROM process_steps WHERE process_id = p1_id;

  SELECT array_agg(id ORDER BY sort_order), array_agg(name ORDER BY sort_order)
  INTO p2_steps, p2_names FROM process_steps WHERE process_id = p2_id;

  SELECT array_agg(id ORDER BY sort_order), array_agg(name ORDER BY sort_order)
  INTO p3_steps, p3_names FROM process_steps WHERE process_id = p3_id;

  -- Combine all steps into one array (P1 → P2 → P3)
  total_steps := array_length(p1_steps, 1) + array_length(p2_steps, 1) + array_length(p3_steps, 1);

  -- Count active projects
  SELECT count(*) INTO proj_count FROM projects
    WHERE company_id = comp_id AND status = 'active';

  -- Distribute projects by age (oldest = furthest along)
  FOR proj IN
    SELECT id, created_at FROM projects
    WHERE company_id = comp_id AND status = 'active'
    ORDER BY created_at ASC  -- oldest first = furthest along
  LOOP
    -- Map project index to a combined step index across all 3 processes
    step_idx := LEAST(total_steps, GREATEST(1,
      FLOOR((proj_idx::NUMERIC / GREATEST(proj_count, 1)) * total_steps) + 1
    ));

    -- Determine which process and step
    IF step_idx <= array_length(p1_steps, 1) THEN
      target_step := p1_steps[step_idx];
      target_name := p1_names[step_idx];
    ELSIF step_idx <= array_length(p1_steps, 1) + array_length(p2_steps, 1) THEN
      target_step := p2_steps[step_idx - array_length(p1_steps, 1)];
      target_name := p2_names[step_idx - array_length(p1_steps, 1)];
    ELSE
      target_step := p3_steps[step_idx - array_length(p1_steps, 1) - array_length(p2_steps, 1)];
      target_name := p3_names[step_idx - array_length(p1_steps, 1) - array_length(p2_steps, 1)];
    END IF;

    UPDATE projects
    SET current_step_id = target_step,
        current_step_name = target_name
    WHERE id = proj.id;

    proj_idx := proj_idx + 1;
  END LOOP;

  RAISE NOTICE 'Redistributed % projects across % steps (P1+P2+P3)', proj_count, total_steps;
END $$;

-- Update today's KPI snapshots with new distribution
DELETE FROM step_kpi_snapshots WHERE snapshot_date = CURRENT_DATE;

INSERT INTO step_kpi_snapshots (company_id, step_id, snapshot_date, project_count, portfolio_value)
SELECT
  p.company_id, p.current_step_id, CURRENT_DATE,
  COUNT(*)::INTEGER, COALESCE(SUM(p.project_value), 0)
FROM projects p
WHERE p.status = 'active' AND p.current_step_id IS NOT NULL
GROUP BY p.company_id, p.current_step_id;


-- ====== 045_supplier_bank_data_protection.sql ======
-- 045_supplier_bank_data_protection.sql
-- Secure supplier bank data management with 4-eyes approval workflow
-- Payments may only use approved, verified bank data

BEGIN;

-- =========================================================================
-- 1. New permissions
-- =========================================================================

INSERT INTO public.permissions (id, key, label, description)
VALUES
  (gen_random_uuid(), 'module:finanzplanung:review_bank_data',
   'Bankdaten pruefen',
   'Bankdatenaenderungen formell pruefen (erster Schritt im 4-Augen-Prinzip)'),
  (gen_random_uuid(), 'module:finanzplanung:approve_bank_data',
   'Bankdaten genehmigen',
   'Bankdatenaenderungen genehmigen (zweiter Schritt im 4-Augen-Prinzip)')
ON CONFLICT (key) DO NOTHING;

-- Assign review_bank_data to cashout_planner role (per company)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key = 'module:finanzplanung:review_bank_data'
WHERE r.key = 'cashout_planner'
ON CONFLICT DO NOTHING;

-- Assign approve_bank_data to financial_approver role (per company)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key = 'module:finanzplanung:approve_bank_data'
WHERE r.key = 'financial_approver'
ON CONFLICT DO NOTHING;

-- Assign both to super_user role
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.key = 'super_user'
  AND p.key IN ('module:finanzplanung:review_bank_data', 'module:finanzplanung:approve_bank_data')
ON CONFLICT DO NOTHING;

-- =========================================================================
-- 2. supplier_bank_data — versioned, approved bank details
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.supplier_bank_data (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id     UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  holding_id      UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  version         INTEGER NOT NULL DEFAULT 1,
  iban            TEXT NOT NULL,
  bic             TEXT,
  bank_name       TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT FALSE,
  activated_at    TIMESTAMPTZ,
  deactivated_at  TIMESTAMPTZ,
  created_by      UUID NOT NULL REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (supplier_id, version)
);

-- Exactly one active bank data record per supplier
CREATE UNIQUE INDEX idx_supplier_bank_data_one_active
  ON public.supplier_bank_data (supplier_id) WHERE is_active = TRUE;

CREATE INDEX idx_supplier_bank_data_supplier
  ON public.supplier_bank_data (supplier_id, is_active);

-- =========================================================================
-- 3. supplier_bank_change_requests — approval workflow
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.supplier_bank_change_requests (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id             UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  holding_id              UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id              UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  -- Proposed values
  proposed_iban           TEXT NOT NULL,
  proposed_bic            TEXT,
  proposed_bank_name      TEXT,
  -- Context
  reason                  TEXT NOT NULL,
  source                  TEXT NOT NULL DEFAULT 'internal'
                            CHECK (source IN ('internal', 'supplier_request', 'invoice_mismatch')),
  evidence_storage_path   TEXT,
  -- Workflow state
  status                  TEXT NOT NULL DEFAULT 'pending_review'
                            CHECK (status IN (
                              'pending_review', 'reviewed', 'approved', 'rejected', 'cancelled'
                            )),
  -- Requester
  requested_by            UUID NOT NULL REFERENCES public.profiles(id),
  requested_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- First reviewer (eye 1)
  reviewed_by             UUID REFERENCES public.profiles(id),
  reviewed_at             TIMESTAMPTZ,
  review_comment          TEXT,
  -- Approver (eye 2)
  approved_by             UUID REFERENCES public.profiles(id),
  approved_at             TIMESTAMPTZ,
  approval_comment        TEXT,
  -- Rejection
  rejected_by             UUID REFERENCES public.profiles(id),
  rejected_at             TIMESTAMPTZ,
  rejection_reason        TEXT,
  -- Result
  resulting_bank_data_id  UUID REFERENCES public.supplier_bank_data(id),
  -- Urgency
  is_urgent               BOOLEAN NOT NULL DEFAULT FALSE,
  urgent_justification    TEXT,
  -- 4-eyes constraints (only enforced when values are set)
  CONSTRAINT chk_four_eyes_reviewer
    CHECK (reviewed_by IS NULL OR reviewed_by IS DISTINCT FROM requested_by),
  CONSTRAINT chk_four_eyes_approver
    CHECK (
      approved_by IS NULL
      OR (approved_by IS DISTINCT FROM requested_by
          AND approved_by IS DISTINCT FROM reviewed_by)
    )
);

-- Only one pending/reviewed request per supplier at a time
CREATE UNIQUE INDEX idx_one_pending_bank_request
  ON public.supplier_bank_change_requests (supplier_id)
  WHERE status IN ('pending_review', 'reviewed');

CREATE INDEX idx_bank_change_requests_status
  ON public.supplier_bank_change_requests (company_id, status)
  WHERE status IN ('pending_review', 'reviewed');

CREATE INDEX idx_bank_change_requests_supplier
  ON public.supplier_bank_change_requests (supplier_id, requested_at DESC);

-- =========================================================================
-- 4. supplier_bank_change_log — immutable audit trail
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.supplier_bank_change_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID REFERENCES public.supplier_bank_change_requests(id) ON DELETE CASCADE,
  holding_id      UUID NOT NULL,
  company_id      UUID NOT NULL,
  action          TEXT NOT NULL CHECK (action IN (
                    'created', 'reviewed', 'approved', 'rejected',
                    'cancelled', 'activated', 'evidence_uploaded'
                  )),
  actor_id        UUID NOT NULL REFERENCES public.profiles(id),
  old_status      TEXT,
  new_status      TEXT,
  comment         TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Append-only enforcement
CREATE RULE no_update_supplier_bank_change_log AS
  ON UPDATE TO public.supplier_bank_change_log DO INSTEAD NOTHING;
CREATE RULE no_delete_supplier_bank_change_log AS
  ON DELETE TO public.supplier_bank_change_log DO INSTEAD NOTHING;

CREATE INDEX idx_bank_change_log_request
  ON public.supplier_bank_change_log (request_id, created_at DESC);

-- =========================================================================
-- 5. Alter suppliers — add verification columns
-- =========================================================================

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS bank_data_verified BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS active_bank_data_id UUID REFERENCES public.supplier_bank_data(id);

-- =========================================================================
-- 6. Alter payment_run_items — enforce supplier + bank data reference
-- =========================================================================

ALTER TABLE public.payment_run_items
  ADD COLUMN IF NOT EXISTS bank_data_id UUID REFERENCES public.supplier_bank_data(id);

-- Note: We do NOT set supplier_id or bank_data_id to NOT NULL yet to avoid
-- breaking existing rows. The application layer enforces these for NEW items.
-- A future migration can backfill and then add the NOT NULL constraint.

-- =========================================================================
-- 7. Trigger: enforce approved bank data on payment_run_items
-- =========================================================================

CREATE OR REPLACE FUNCTION public.enforce_supplier_bank_data()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_bank public.supplier_bank_data%ROWTYPE;
  v_supplier_name TEXT;
BEGIN
  -- Skip enforcement for rows without bank_data_id (legacy rows)
  IF NEW.bank_data_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Look up the active bank data
  SELECT * INTO v_bank
    FROM public.supplier_bank_data
   WHERE id = NEW.bank_data_id
     AND supplier_id = NEW.supplier_id
     AND is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_run_item references invalid or inactive bank data (bank_data_id=%, supplier_id=%)',
      NEW.bank_data_id, NEW.supplier_id;
  END IF;

  -- Force creditor fields to match approved data — no manual override possible
  SELECT name INTO v_supplier_name FROM public.suppliers WHERE id = NEW.supplier_id;
  NEW.creditor_iban := v_bank.iban;
  NEW.creditor_bic  := v_bank.bic;
  NEW.creditor_name := v_supplier_name;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_supplier_bank_data
  BEFORE INSERT OR UPDATE ON public.payment_run_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_supplier_bank_data();

-- =========================================================================
-- 8. Trigger: block direct bank field edits on suppliers
-- =========================================================================

CREATE OR REPLACE FUNCTION public.protect_supplier_bank_fields()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Block direct edits to bank fields; they must go through the change request workflow
  IF (OLD.iban IS DISTINCT FROM NEW.iban) OR
     (OLD.bic IS DISTINCT FROM NEW.bic) OR
     (OLD.bank_name IS DISTINCT FROM NEW.bank_name) THEN
    -- Allow service_role (used by the approval workflow backend)
    IF current_setting('role', TRUE) <> 'service_role' THEN
      RAISE EXCEPTION 'Bank detail changes must go through the supplier_bank_change_requests workflow';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_supplier_bank_fields
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.protect_supplier_bank_fields();

-- =========================================================================
-- 9. RLS for new tables
-- =========================================================================

DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'supplier_bank_data',
    'supplier_bank_change_requests',
    'supplier_bank_change_log'
  ]) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    -- Enura admin: full access
    EXECUTE format(
      'CREATE POLICY "sbd_enura_%s" ON public.%I FOR ALL USING (public.is_enura_admin())',
      tbl, tbl);

    -- Holding admin: full access to own holding
    EXECUTE format(
      'CREATE POLICY "sbd_holding_%s" ON public.%I FOR ALL USING (holding_id = public.current_holding_id() AND public.is_holding_admin())',
      tbl, tbl);

    -- Company user: read with finanzplanung:read
    EXECUTE format(
      'CREATE POLICY "sbd_company_read_%s" ON public.%I FOR SELECT USING (company_id = public.current_company_id() AND public.has_permission(''module:finanzplanung:read''))',
      tbl, tbl);
  END LOOP;
END $$;

-- Additional write policies for change requests
CREATE POLICY "sbd_company_create_request"
  ON public.supplier_bank_change_requests
  FOR INSERT WITH CHECK (
    company_id = public.current_company_id()
    AND public.has_permission('module:finanzplanung:manage_suppliers')
  );

-- Change log: any finanzplanung user can insert (actions are validated in app layer)
CREATE POLICY "sbd_company_insert_log"
  ON public.supplier_bank_change_log
  FOR INSERT WITH CHECK (
    company_id = public.current_company_id()
    AND public.has_permission('module:finanzplanung:read')
  );

-- =========================================================================
-- 10. Migrate existing supplier bank data
-- =========================================================================

-- Create version 0 bank_data rows for suppliers that already have IBAN
INSERT INTO public.supplier_bank_data (
  supplier_id, holding_id, company_id, version, iban, bic, bank_name,
  is_active, activated_at, created_by
)
SELECT
  s.id, s.holding_id, s.company_id, 0, s.iban, s.bic, s.bank_name,
  TRUE, NOW(), COALESCE(s.created_by, (SELECT id FROM public.profiles LIMIT 1))
FROM public.suppliers s
WHERE s.iban IS NOT NULL
  AND s.iban <> ''
ON CONFLICT (supplier_id, version) DO NOTHING;

-- Update suppliers to reference their new bank_data row + mark as verified
UPDATE public.suppliers s
SET
  active_bank_data_id = sbd.id,
  bank_data_verified = TRUE
FROM public.supplier_bank_data sbd
WHERE sbd.supplier_id = s.id
  AND sbd.is_active = TRUE
  AND s.active_bank_data_id IS NULL;

-- Create migration log entries for migrated data
INSERT INTO public.supplier_bank_change_log (
  request_id, holding_id, company_id, action, actor_id, new_status, metadata
)
SELECT
  NULL, -- no request_id for migration entries
  sbd.holding_id, sbd.company_id, 'activated', sbd.created_by, 'approved',
  jsonb_build_object('migration', '045', 'source', 'legacy_data', 'iban_last4', right(sbd.iban, 4))
FROM public.supplier_bank_data sbd
WHERE sbd.version = 0 AND sbd.is_active = TRUE;

COMMIT;


-- ====== 046_optional_2fa.sql ======
-- 046_optional_2fa.sql
-- Make 2FA optional per company (default: optional)

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS require_2fa BOOLEAN NOT NULL DEFAULT FALSE;


-- ====== 047_webhook_events.sql ======
-- =============================================================================
-- 047_webhook_events.sql
--
-- Stores incoming webhook deliveries for idempotency + audit.
-- Used by:
--   - /api/webhooks/reonic (offer.signed → Bexio order)
--   - future webhook receivers (3CX, Google Calendar push, etc.)
-- =============================================================================

CREATE TABLE webhook_events (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id           UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    source               TEXT NOT NULL,            -- 'reonic', '3cx', 'gcal', ...
    external_event_id    TEXT,                     -- Provider's unique event ID (for dedup)
    event_type           TEXT NOT NULL,            -- 'offer.signed', 'offer.created', ...
    payload              JSONB NOT NULL,
    status               TEXT NOT NULL DEFAULT 'received',  -- received, processed, error
    error_message        TEXT,
    received_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at         TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_webhook_events_dedup
    ON webhook_events(source, external_event_id)
    WHERE external_event_id IS NOT NULL;

CREATE INDEX idx_webhook_events_company_received
    ON webhook_events(company_id, received_at DESC);

CREATE INDEX idx_webhook_events_status
    ON webhook_events(status, received_at DESC)
    WHERE status IN ('received', 'error');

-- RLS: tenants see their own events, holding admins see all
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY webhook_events_select ON webhook_events
    FOR SELECT USING (
        is_holding_admin() OR company_id = current_tenant_id()
    );

-- Inserts come from the service-role client only (webhook receivers run
-- server-side with the service role key) — no user-facing INSERT policy needed.

