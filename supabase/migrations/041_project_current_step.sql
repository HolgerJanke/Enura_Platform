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
