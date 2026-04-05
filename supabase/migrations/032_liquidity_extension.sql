-- 032_liquidity_extension.sql
-- Extend liquidity_event_instances with scheduled, residual, and invoice columns

BEGIN;

-- Rename plan_amount/plan_date to budget_amount/budget_date
ALTER TABLE public.liquidity_event_instances
  RENAME COLUMN plan_amount TO budget_amount;
ALTER TABLE public.liquidity_event_instances
  RENAME COLUMN plan_date TO budget_date;

-- Add scheduled columns (set by Cash-out Planer)
ALTER TABLE public.liquidity_event_instances
  ADD COLUMN IF NOT EXISTS scheduled_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS scheduled_date   DATE,
  ADD COLUMN IF NOT EXISTS scheduled_by     UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS scheduled_at     TIMESTAMPTZ;

-- Add residual value columns
ALTER TABLE public.liquidity_event_instances
  ADD COLUMN IF NOT EXISTS residual_1_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS residual_1_date   DATE,
  ADD COLUMN IF NOT EXISTS residual_2_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS residual_2_date   DATE,
  ADD COLUMN IF NOT EXISTS residual_3_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS residual_3_date   DATE;

-- Link to source invoice
ALTER TABLE public.liquidity_event_instances
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices_incoming(id);

-- Backward-compatibility view (plan_amount/plan_date aliases)
CREATE OR REPLACE VIEW public.liquidity_event_instances_compat AS
  SELECT *, budget_amount AS plan_amount, budget_date AS plan_date
  FROM public.liquidity_event_instances;

-- Display priority helper functions
CREATE OR REPLACE FUNCTION public.liq_display_amount(
  p_budget_amount    NUMERIC,
  p_scheduled_amount NUMERIC,
  p_actual_amount    NUMERIC
) RETURNS NUMERIC LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(p_actual_amount, p_scheduled_amount, p_budget_amount);
$$;

CREATE OR REPLACE FUNCTION public.liq_display_date(
  p_budget_date    DATE,
  p_scheduled_date DATE,
  p_actual_date    DATE
) RETURNS DATE LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(p_actual_date, p_scheduled_date, p_budget_date);
$$;

-- Update indexes for renamed columns
DROP INDEX IF EXISTS idx_liq_instances_company_date;
CREATE INDEX idx_liq_instances_company_date
  ON public.liquidity_event_instances (company_id, budget_date, marker_type)
  WHERE marker_type = 'event';

CREATE INDEX IF NOT EXISTS idx_liq_scheduled_date
  ON public.liquidity_event_instances (company_id, scheduled_date)
  WHERE scheduled_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_liq_invoice
  ON public.liquidity_event_instances (invoice_id)
  WHERE invoice_id IS NOT NULL;

COMMIT;
