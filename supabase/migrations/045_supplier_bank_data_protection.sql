-- 045_supplier_bank_data_protection.sql
-- Secure supplier bank data management with 4-eyes approval workflow
-- Payments may only use approved, verified bank data

BEGIN;

-- =========================================================================
-- 1. New permissions
-- =========================================================================

INSERT INTO public.permissions (id, key, label, description)
VALUES
  (gen_random_uuid(), 'module:finanzplanung:review_bank_data',
   'Bankdaten pruefen',
   'Bankdatenaenderungen formell pruefen (erster Schritt im 4-Augen-Prinzip)'),
  (gen_random_uuid(), 'module:finanzplanung:approve_bank_data',
   'Bankdaten genehmigen',
   'Bankdatenaenderungen genehmigen (zweiter Schritt im 4-Augen-Prinzip)')
ON CONFLICT (key) DO NOTHING;

-- Assign review_bank_data to cashout_planner role (per company)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key = 'module:finanzplanung:review_bank_data'
WHERE r.key = 'cashout_planner'
ON CONFLICT DO NOTHING;

-- Assign approve_bank_data to financial_approver role (per company)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key = 'module:finanzplanung:approve_bank_data'
WHERE r.key = 'financial_approver'
ON CONFLICT DO NOTHING;

-- Assign both to super_user role
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.key = 'super_user'
  AND p.key IN ('module:finanzplanung:review_bank_data', 'module:finanzplanung:approve_bank_data')
ON CONFLICT DO NOTHING;

-- =========================================================================
-- 2. supplier_bank_data — versioned, approved bank details
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.supplier_bank_data (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id     UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  holding_id      UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  version         INTEGER NOT NULL DEFAULT 1,
  iban            TEXT NOT NULL,
  bic             TEXT,
  bank_name       TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT FALSE,
  activated_at    TIMESTAMPTZ,
  deactivated_at  TIMESTAMPTZ,
  created_by      UUID NOT NULL REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (supplier_id, version)
);

-- Exactly one active bank data record per supplier
CREATE UNIQUE INDEX idx_supplier_bank_data_one_active
  ON public.supplier_bank_data (supplier_id) WHERE is_active = TRUE;

CREATE INDEX idx_supplier_bank_data_supplier
  ON public.supplier_bank_data (supplier_id, is_active);

-- =========================================================================
-- 3. supplier_bank_change_requests — approval workflow
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.supplier_bank_change_requests (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id             UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  holding_id              UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id              UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  -- Proposed values
  proposed_iban           TEXT NOT NULL,
  proposed_bic            TEXT,
  proposed_bank_name      TEXT,
  -- Context
  reason                  TEXT NOT NULL,
  source                  TEXT NOT NULL DEFAULT 'internal'
                            CHECK (source IN ('internal', 'supplier_request', 'invoice_mismatch')),
  evidence_storage_path   TEXT,
  -- Workflow state
  status                  TEXT NOT NULL DEFAULT 'pending_review'
                            CHECK (status IN (
                              'pending_review', 'reviewed', 'approved', 'rejected', 'cancelled'
                            )),
  -- Requester
  requested_by            UUID NOT NULL REFERENCES public.profiles(id),
  requested_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- First reviewer (eye 1)
  reviewed_by             UUID REFERENCES public.profiles(id),
  reviewed_at             TIMESTAMPTZ,
  review_comment          TEXT,
  -- Approver (eye 2)
  approved_by             UUID REFERENCES public.profiles(id),
  approved_at             TIMESTAMPTZ,
  approval_comment        TEXT,
  -- Rejection
  rejected_by             UUID REFERENCES public.profiles(id),
  rejected_at             TIMESTAMPTZ,
  rejection_reason        TEXT,
  -- Result
  resulting_bank_data_id  UUID REFERENCES public.supplier_bank_data(id),
  -- Urgency
  is_urgent               BOOLEAN NOT NULL DEFAULT FALSE,
  urgent_justification    TEXT,
  -- 4-eyes constraints (only enforced when values are set)
  CONSTRAINT chk_four_eyes_reviewer
    CHECK (reviewed_by IS NULL OR reviewed_by IS DISTINCT FROM requested_by),
  CONSTRAINT chk_four_eyes_approver
    CHECK (
      approved_by IS NULL
      OR (approved_by IS DISTINCT FROM requested_by
          AND approved_by IS DISTINCT FROM reviewed_by)
    )
);

-- Only one pending/reviewed request per supplier at a time
CREATE UNIQUE INDEX idx_one_pending_bank_request
  ON public.supplier_bank_change_requests (supplier_id)
  WHERE status IN ('pending_review', 'reviewed');

CREATE INDEX idx_bank_change_requests_status
  ON public.supplier_bank_change_requests (company_id, status)
  WHERE status IN ('pending_review', 'reviewed');

CREATE INDEX idx_bank_change_requests_supplier
  ON public.supplier_bank_change_requests (supplier_id, requested_at DESC);

-- =========================================================================
-- 4. supplier_bank_change_log — immutable audit trail
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.supplier_bank_change_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID REFERENCES public.supplier_bank_change_requests(id) ON DELETE CASCADE,
  holding_id      UUID NOT NULL,
  company_id      UUID NOT NULL,
  action          TEXT NOT NULL CHECK (action IN (
                    'created', 'reviewed', 'approved', 'rejected',
                    'cancelled', 'activated', 'evidence_uploaded'
                  )),
  actor_id        UUID NOT NULL REFERENCES public.profiles(id),
  old_status      TEXT,
  new_status      TEXT,
  comment         TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Append-only enforcement
CREATE RULE no_update_supplier_bank_change_log AS
  ON UPDATE TO public.supplier_bank_change_log DO INSTEAD NOTHING;
CREATE RULE no_delete_supplier_bank_change_log AS
  ON DELETE TO public.supplier_bank_change_log DO INSTEAD NOTHING;

CREATE INDEX idx_bank_change_log_request
  ON public.supplier_bank_change_log (request_id, created_at DESC);

-- =========================================================================
-- 5. Alter suppliers — add verification columns
-- =========================================================================

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS bank_data_verified BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS active_bank_data_id UUID REFERENCES public.supplier_bank_data(id);

-- =========================================================================
-- 6. Alter payment_run_items — enforce supplier + bank data reference
-- =========================================================================

ALTER TABLE public.payment_run_items
  ADD COLUMN IF NOT EXISTS bank_data_id UUID REFERENCES public.supplier_bank_data(id);

-- Note: We do NOT set supplier_id or bank_data_id to NOT NULL yet to avoid
-- breaking existing rows. The application layer enforces these for NEW items.
-- A future migration can backfill and then add the NOT NULL constraint.

-- =========================================================================
-- 7. Trigger: enforce approved bank data on payment_run_items
-- =========================================================================

CREATE OR REPLACE FUNCTION public.enforce_supplier_bank_data()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_bank public.supplier_bank_data%ROWTYPE;
  v_supplier_name TEXT;
BEGIN
  -- Skip enforcement for rows without bank_data_id (legacy rows)
  IF NEW.bank_data_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Look up the active bank data
  SELECT * INTO v_bank
    FROM public.supplier_bank_data
   WHERE id = NEW.bank_data_id
     AND supplier_id = NEW.supplier_id
     AND is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_run_item references invalid or inactive bank data (bank_data_id=%, supplier_id=%)',
      NEW.bank_data_id, NEW.supplier_id;
  END IF;

  -- Force creditor fields to match approved data — no manual override possible
  SELECT name INTO v_supplier_name FROM public.suppliers WHERE id = NEW.supplier_id;
  NEW.creditor_iban := v_bank.iban;
  NEW.creditor_bic  := v_bank.bic;
  NEW.creditor_name := v_supplier_name;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_supplier_bank_data
  BEFORE INSERT OR UPDATE ON public.payment_run_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_supplier_bank_data();

-- =========================================================================
-- 8. Trigger: block direct bank field edits on suppliers
-- =========================================================================

CREATE OR REPLACE FUNCTION public.protect_supplier_bank_fields()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Block direct edits to bank fields; they must go through the change request workflow
  IF (OLD.iban IS DISTINCT FROM NEW.iban) OR
     (OLD.bic IS DISTINCT FROM NEW.bic) OR
     (OLD.bank_name IS DISTINCT FROM NEW.bank_name) THEN
    -- Allow service_role (used by the approval workflow backend)
    IF current_setting('role', TRUE) <> 'service_role' THEN
      RAISE EXCEPTION 'Bank detail changes must go through the supplier_bank_change_requests workflow';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_supplier_bank_fields
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.protect_supplier_bank_fields();

-- =========================================================================
-- 9. RLS for new tables
-- =========================================================================

DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'supplier_bank_data',
    'supplier_bank_change_requests',
    'supplier_bank_change_log'
  ]) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    -- Enura admin: full access
    EXECUTE format(
      'CREATE POLICY "sbd_enura_%s" ON public.%I FOR ALL USING (public.is_enura_admin())',
      tbl, tbl);

    -- Holding admin: full access to own holding
    EXECUTE format(
      'CREATE POLICY "sbd_holding_%s" ON public.%I FOR ALL USING (holding_id = public.current_holding_id() AND public.is_holding_admin())',
      tbl, tbl);

    -- Company user: read with finanzplanung:read
    EXECUTE format(
      'CREATE POLICY "sbd_company_read_%s" ON public.%I FOR SELECT USING (company_id = public.current_company_id() AND public.has_permission(''module:finanzplanung:read''))',
      tbl, tbl);
  END LOOP;
END $$;

-- Additional write policies for change requests
CREATE POLICY "sbd_company_create_request"
  ON public.supplier_bank_change_requests
  FOR INSERT WITH CHECK (
    company_id = public.current_company_id()
    AND public.has_permission('module:finanzplanung:manage_suppliers')
  );

-- Change log: any finanzplanung user can insert (actions are validated in app layer)
CREATE POLICY "sbd_company_insert_log"
  ON public.supplier_bank_change_log
  FOR INSERT WITH CHECK (
    company_id = public.current_company_id()
    AND public.has_permission('module:finanzplanung:read')
  );

-- =========================================================================
-- 10. Migrate existing supplier bank data
-- =========================================================================

-- Create version 0 bank_data rows for suppliers that already have IBAN
INSERT INTO public.supplier_bank_data (
  supplier_id, holding_id, company_id, version, iban, bic, bank_name,
  is_active, activated_at, created_by
)
SELECT
  s.id, s.holding_id, s.company_id, 0, s.iban, s.bic, s.bank_name,
  TRUE, NOW(), COALESCE(s.created_by, (SELECT id FROM public.profiles LIMIT 1))
FROM public.suppliers s
WHERE s.iban IS NOT NULL
  AND s.iban <> ''
ON CONFLICT (supplier_id, version) DO NOTHING;

-- Update suppliers to reference their new bank_data row + mark as verified
UPDATE public.suppliers s
SET
  active_bank_data_id = sbd.id,
  bank_data_verified = TRUE
FROM public.supplier_bank_data sbd
WHERE sbd.supplier_id = s.id
  AND sbd.is_active = TRUE
  AND s.active_bank_data_id IS NULL;

-- Create migration log entries for migrated data
INSERT INTO public.supplier_bank_change_log (
  request_id, holding_id, company_id, action, actor_id, new_status, metadata
)
SELECT
  NULL, -- no request_id for migration entries
  sbd.holding_id, sbd.company_id, 'activated', sbd.created_by, 'approved',
  jsonb_build_object('migration', '045', 'source', 'legacy_data', 'iban_last4', right(sbd.iban, 4))
FROM public.supplier_bank_data sbd
WHERE sbd.version = 0 AND sbd.is_active = TRUE;

COMMIT;
