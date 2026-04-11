-- 035: Add criticality and rhythm fields to process_steps
ALTER TABLE public.process_steps
  ADD COLUMN IF NOT EXISTS criticality TEXT CHECK (criticality IS NULL OR criticality IN ('A', 'B', 'C')),
  ADD COLUMN IF NOT EXISTS rhythm TEXT;
