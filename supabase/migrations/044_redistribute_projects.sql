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
