-- 031_payment_infrastructure.sql
-- Payment runs, items, residual decisions, company banking config

BEGIN;

-- 1. Company banking configuration
CREATE TABLE IF NOT EXISTS public.company_banking_config (
  company_id          UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  holding_id          UUID NOT NULL REFERENCES public.holdings(id),
  iban                TEXT,
  bic                 TEXT,
  bank_name           TEXT,
  account_holder_name TEXT,
  payment_format      TEXT NOT NULL DEFAULT 'pain001_ch'
                        CHECK (payment_format IN ('pain001_sepa','pain001_ch','mt101','csv_custom')),
  csv_column_mapping  JSONB,
  creditor_id         TEXT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backfill for existing companies
INSERT INTO public.company_banking_config (company_id, holding_id)
SELECT id, holding_id FROM public.companies
ON CONFLICT (company_id) DO NOTHING;

-- 2. Payment runs
CREATE TABLE IF NOT EXISTS public.payment_runs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id            UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id            UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  run_date              DATE NOT NULL,
  name                  TEXT,
  created_by            UUID NOT NULL REFERENCES public.profiles(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_amount          NUMERIC(14,2) NOT NULL DEFAULT 0,
  item_count            INTEGER NOT NULL DEFAULT 0,
  currency              TEXT NOT NULL DEFAULT 'CHF',
  status                TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN (
                            'draft','submitted','under_review',
                            'approved','rejected','exported','confirmed_paid'
                          )),
  submitted_by          UUID REFERENCES public.profiles(id),
  submitted_at          TIMESTAMPTZ,
  planner_reviewed_all  BOOLEAN NOT NULL DEFAULT FALSE,
  approved_by           UUID REFERENCES public.profiles(id),
  approved_at           TIMESTAMPTZ,
  approver_reviewed_all BOOLEAN NOT NULL DEFAULT FALSE,
  rejection_reason      TEXT,
  payment_format        TEXT,
  file_storage_path     TEXT,
  exported_at           TIMESTAMPTZ,
  exported_by           UUID REFERENCES public.profiles(id),
  notes                 TEXT
);

-- 3. Payment run items
CREATE TABLE IF NOT EXISTS public.payment_run_items (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id                  UUID NOT NULL REFERENCES public.payment_runs(id) ON DELETE CASCADE,
  holding_id              UUID NOT NULL,
  company_id              UUID NOT NULL,
  invoice_id              UUID NOT NULL REFERENCES public.invoices_incoming(id),
  supplier_id             UUID REFERENCES public.suppliers(id),
  creditor_name           TEXT NOT NULL,
  creditor_iban           TEXT NOT NULL,
  creditor_bic            TEXT,
  amount                  NUMERIC(14,2) NOT NULL,
  currency                TEXT NOT NULL DEFAULT 'CHF',
  payment_reference       TEXT,
  remittance_info         TEXT,
  reviewed_by_planner     BOOLEAN NOT NULL DEFAULT FALSE,
  reviewed_by_planner_at  TIMESTAMPTZ,
  reviewed_by_approver    BOOLEAN NOT NULL DEFAULT FALSE,
  reviewed_by_approver_at TIMESTAMPTZ,
  sort_order              INTEGER NOT NULL DEFAULT 0
);

-- 4. Residual value decisions
CREATE TABLE IF NOT EXISTS public.cashout_residual_decisions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id          UUID NOT NULL,
  company_id          UUID NOT NULL,
  instance_id         UUID NOT NULL REFERENCES public.liquidity_event_instances(id) ON DELETE CASCADE,
  invoice_id          UUID NOT NULL REFERENCES public.invoices_incoming(id),
  residual_number     SMALLINT NOT NULL CHECK (residual_number IN (1, 2, 3)),
  decision            TEXT NOT NULL CHECK (decision IN ('keep', 'zero')),
  residual_amount     NUMERIC(14,2),
  residual_date       DATE,
  decided_by          UUID NOT NULL REFERENCES public.profiles(id),
  decided_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes               TEXT,
  UNIQUE (instance_id, residual_number)
);

-- 5. RLS
DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'payment_runs','payment_run_items',
    'cashout_residual_decisions','company_banking_config'
  ]) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format(
      'CREATE POLICY "pay_enura_%s" ON public.%I FOR ALL USING (public.is_enura_admin())', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "pay_holding_%s" ON public.%I FOR ALL USING (holding_id = public.current_holding_id() AND public.is_holding_admin())', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "pay_company_%s" ON public.%I FOR ALL USING (company_id = public.current_company_id() AND public.has_permission(''module:finanzplanung:read''))', tbl, tbl);
  END LOOP;
END $$;

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_payment_runs_company_status ON public.payment_runs (company_id, status, run_date DESC);
CREATE INDEX IF NOT EXISTS idx_payment_runs_approver ON public.payment_runs (company_id, status) WHERE status IN ('submitted','under_review');
CREATE INDEX IF NOT EXISTS idx_payment_run_items_run ON public.payment_run_items (run_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_payment_run_items_invoice ON public.payment_run_items (invoice_id);
CREATE INDEX IF NOT EXISTS idx_residual_decisions_instance ON public.cashout_residual_decisions (instance_id, residual_number);

CREATE TRIGGER trg_payment_runs_updated
  BEFORE UPDATE ON public.payment_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;
