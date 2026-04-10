-- 029_suppliers.sql
-- Supplier master data for Finanzplanung module

BEGIN;

CREATE TABLE IF NOT EXISTS public.suppliers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id            UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id            UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  address_line_1        TEXT,
  address_line_2        TEXT,
  postal_code           TEXT,
  city                  TEXT,
  country               TEXT NOT NULL DEFAULT 'CH',
  registration_number   TEXT,
  vat_number            TEXT,
  contact_name          TEXT,
  contact_phone         TEXT,
  contact_email         TEXT,
  iban                  TEXT,
  bic                   TEXT,
  bank_name             TEXT,
  preferred_payment_days INTEGER NOT NULL DEFAULT 30,
  name_normalized       TEXT GENERATED ALWAYS AS (lower(trim(name))) STORED,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_from_invoice  UUID,  -- FK added after invoices_incoming table exists
  created_by            UUID REFERENCES public.profiles(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_holding ON public.suppliers (holding_id, is_active);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON public.suppliers (holding_id, name_normalized);
CREATE INDEX IF NOT EXISTS idx_suppliers_vat ON public.suppliers (holding_id, vat_number) WHERE vat_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_suppliers_iban ON public.suppliers (holding_id, iban) WHERE iban IS NOT NULL;

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suppliers_enura" ON public.suppliers FOR ALL
  USING (public.is_enura_admin());
CREATE POLICY "suppliers_holding_admin" ON public.suppliers FOR ALL
  USING (holding_id = public.current_holding_id() AND public.is_holding_admin());
CREATE POLICY "suppliers_company_write" ON public.suppliers FOR ALL
  USING (company_id = public.current_company_id()
         AND public.has_permission('module:finanzplanung:manage_suppliers'));
CREATE POLICY "suppliers_company_read" ON public.suppliers FOR SELECT
  USING (company_id = public.current_company_id()
         AND public.has_permission('module:finanzplanung:read'));

CREATE TRIGGER trg_suppliers_updated
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;
