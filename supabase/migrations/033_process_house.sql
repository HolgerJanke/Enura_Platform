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
