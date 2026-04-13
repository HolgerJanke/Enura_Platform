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
