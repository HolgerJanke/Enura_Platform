-- 030_invoices_incoming.sql
-- Invoice tables: incoming invoices, line items, validations, approvals

BEGIN;

-- 1. Incoming invoices
CREATE TABLE IF NOT EXISTS public.invoices_incoming (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id          UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id          UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id          UUID REFERENCES public.projects(id),
  step_id             UUID REFERENCES public.process_steps(id),
  supplier_id         UUID REFERENCES public.suppliers(id),
  -- Raw storage
  raw_storage_path    TEXT NOT NULL,
  raw_filename        TEXT,
  raw_mime_type       TEXT,
  -- Incomer metadata
  incomer_type        TEXT NOT NULL CHECK (incomer_type IN ('email','sftp','webhook','manual_upload')),
  incomer_ref         TEXT,
  incomer_received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- KI extraction
  extracted_data      JSONB,
  extraction_status   TEXT NOT NULL DEFAULT 'pending'
                        CHECK (extraction_status IN ('pending','processing','completed','failed')),
  extraction_error    TEXT,
  extraction_model    TEXT,
  extraction_at       TIMESTAMPTZ,
  -- Extracted header fields
  invoice_number      TEXT,
  invoice_date        DATE,
  recipient_name      TEXT,
  recipient_address   TEXT,
  recipient_reg_number TEXT,
  sender_name         TEXT,
  sender_address      TEXT,
  sender_reg_number   TEXT,
  sender_vat_number   TEXT,
  sender_email        TEXT,
  sender_contact_name TEXT,
  sender_contact_phone TEXT,
  -- Financial totals
  net_amount          NUMERIC(14,2),
  vat_rate            NUMERIC(5,2),
  vat_amount          NUMERIC(14,2),
  gross_amount        NUMERIC(14,2),
  currency            TEXT NOT NULL DEFAULT 'CHF',
  -- Payment terms
  payment_terms_days  INTEGER,
  payment_terms_text  TEXT,
  due_date            DATE,
  -- Project matching
  project_ref_raw     TEXT,
  customer_name_raw   TEXT,
  customer_address_raw TEXT,
  match_confidence    NUMERIC(4,3),
  match_method        TEXT CHECK (match_method IN (
                        'project_number','customer_name','customer_address',
                        'amount_date','manual','unmatched'
                      )),
  -- Workflow status
  status              TEXT NOT NULL DEFAULT 'received'
                        CHECK (status IN (
                          'received','extraction_done','match_review',
                          'in_validation','returned_formal','formally_approved',
                          'pending_approval','returned_internal','returned_sender',
                          'approved','scheduled','in_payment_run','paid'
                        )),
  -- Duplicate detection
  is_duplicate        BOOLEAN NOT NULL DEFAULT FALSE,
  duplicate_of        UUID REFERENCES public.invoices_incoming(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Invoice line items
CREATE TABLE IF NOT EXISTS public.invoice_line_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID NOT NULL REFERENCES public.invoices_incoming(id) ON DELETE CASCADE,
  holding_id      UUID NOT NULL,
  company_id      UUID NOT NULL,
  position        INTEGER NOT NULL,
  article_number  TEXT,
  description     TEXT NOT NULL,
  quantity        NUMERIC(12,3),
  unit            TEXT,
  unit_price      NUMERIC(14,2),
  line_total      NUMERIC(14,2),
  vat_rate        NUMERIC(5,2)
);

-- 3. Invoice validation log (append-only)
CREATE TABLE IF NOT EXISTS public.invoice_validations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id            UUID NOT NULL REFERENCES public.invoices_incoming(id) ON DELETE CASCADE,
  holding_id            UUID NOT NULL,
  company_id            UUID NOT NULL,
  validation_step       SMALLINT NOT NULL CHECK (validation_step IN (1, 2, 3)),
  action                TEXT NOT NULL CHECK (action IN (
                          'formal_pass','formal_return',
                          'content_pass','due_date_override','content_return',
                          'internal_fix','return_after_reject','approve','reject'
                        )),
  actor_id              UUID NOT NULL REFERENCES public.profiles(id),
  comment               TEXT,
  planned_date_override DATE,
  approval_channel      TEXT CHECK (approval_channel IN ('platform','whatsapp')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Append-only enforcement
CREATE RULE no_update_invoice_validations AS
  ON UPDATE TO public.invoice_validations DO INSTEAD NOTHING;
CREATE RULE no_delete_invoice_validations AS
  ON DELETE TO public.invoice_validations DO INSTEAD NOTHING;

-- 4. Invoice approvals
CREATE TABLE IF NOT EXISTS public.invoice_approvals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id          UUID NOT NULL REFERENCES public.invoices_incoming(id) ON DELETE CASCADE,
  holding_id          UUID NOT NULL,
  company_id          UUID NOT NULL,
  approver_id         UUID NOT NULL REFERENCES public.profiles(id),
  requested_by        UUID NOT NULL REFERENCES public.profiles(id),
  requested_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  whatsapp_number     TEXT,
  whatsapp_message_id TEXT,
  channel             TEXT CHECK (channel IN ('platform','whatsapp')),
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','approved','rejected','expired')),
  response_text       TEXT,
  responded_at        TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days'
);

-- 5. Add FK from suppliers.created_from_invoice
ALTER TABLE public.suppliers
  ADD CONSTRAINT suppliers_created_from_invoice_fk
  FOREIGN KEY (created_from_invoice) REFERENCES public.invoices_incoming(id);

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_company_status ON public.invoices_incoming (company_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_supplier ON public.invoices_incoming (supplier_id, company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_project ON public.invoices_incoming (project_id, step_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_due ON public.invoices_incoming (company_id, due_date) WHERE status NOT IN ('paid','returned_formal','returned_sender');
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_line_items (invoice_id, position);
CREATE INDEX IF NOT EXISTS idx_invoice_validations_invoice ON public.invoice_validations (invoice_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_approvals_invoice ON public.invoice_approvals (invoice_id, status);
CREATE INDEX IF NOT EXISTS idx_invoice_approvals_approver ON public.invoice_approvals (approver_id, status) WHERE status = 'pending';

-- 7. RLS for all four tables
DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'invoices_incoming','invoice_line_items',
    'invoice_validations','invoice_approvals'
  ]) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format(
      'CREATE POLICY "fp_enura_%s" ON public.%I FOR ALL USING (public.is_enura_admin())', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "fp_holding_%s" ON public.%I FOR ALL USING (holding_id = public.current_holding_id() AND public.is_holding_admin())', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "fp_company_%s" ON public.%I FOR ALL USING (company_id = public.current_company_id() AND public.has_permission(''module:finanzplanung:read''))', tbl, tbl);
  END LOOP;
END $$;

CREATE TRIGGER trg_invoices_updated
  BEFORE UPDATE ON public.invoices_incoming
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;
