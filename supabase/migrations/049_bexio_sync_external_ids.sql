-- 049_bexio_sync_external_ids.sql
-- Add external_id columns to suppliers and invoices_incoming for Bexio connector sync.
-- The Bexio connector upserts on (company_id, external_id) to avoid duplicates.

BEGIN;

-- 1. suppliers.external_id — maps to Bexio contact.id
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS external_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_external
  ON public.suppliers (company_id, external_id)
  WHERE external_id IS NOT NULL;

-- 2. invoices_incoming.external_id — maps to Bexio kb_bill.id
ALTER TABLE public.invoices_incoming
  ADD COLUMN IF NOT EXISTS external_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_incoming_external
  ON public.invoices_incoming (company_id, external_id)
  WHERE external_id IS NOT NULL;

-- 3. suppliers.bank_data_verified — referenced by lieferanten page
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS bank_data_verified BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
