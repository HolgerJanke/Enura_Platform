-- 037: Add description, value, size, and start date to projects

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS project_value NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS system_size_kwp NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS project_start_date DATE;
