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
