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
