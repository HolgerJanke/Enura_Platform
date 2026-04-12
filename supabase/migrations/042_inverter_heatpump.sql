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
