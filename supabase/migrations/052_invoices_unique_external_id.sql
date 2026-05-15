-- 052_invoices_unique_external_id.sql
-- Add unique index on invoices(company_id, external_id) so the Bexio sync
-- can upsert outgoing invoices with ON CONFLICT.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_external
  ON public.invoices (company_id, external_id)
  WHERE external_id IS NOT NULL;

COMMIT;
