-- 048_finance_contracts_procurement.sql
-- Finance module extension: customer contracts, payment schedules (sales side),
-- procurement items / delivery plans, and project cost calculations (Kalkulationen).
-- Integrates with: projects, suppliers, invoices (Bexio outgoing), invoices_incoming,
-- liquidity_event_instances, payment_runs.

BEGIN;

-- =============================================================================
-- 1. customer_contracts — Kundenvertrag / Auftragswert
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.customer_contracts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id            UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id            UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id            UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  -- Contract header
  contract_number       TEXT,
  contract_date         DATE,
  signed_at             TIMESTAMPTZ,
  signed_by             UUID REFERENCES public.profiles(id),
  -- Financial
  auftragswert          NUMERIC(14,2) NOT NULL,
  currency              TEXT NOT NULL DEFAULT 'CHF',
  payment_terms_days    INTEGER NOT NULL DEFAULT 30,
  payment_terms_text    TEXT,
  -- Document link (storage path in Supabase Storage)
  contract_document_path TEXT,
  -- Validation flag: SUM(payment_schedule_sales.planned_amount) must = auftragswert
  schedule_amount_valid BOOLEAN NOT NULL DEFAULT FALSE,
  schedule_deviation    NUMERIC(14,2) DEFAULT 0,
  -- Status
  status                TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN (
                            'draft',         -- Entwurf
                            'sent',          -- Dem Kunden gesendet
                            'signed',        -- Unterschrieben
                            'active',        -- Aktiv / in Ausführung
                            'completed',     -- Abgeschlossen
                            'cancelled'      -- Storniert
                          )),
  notes                 TEXT,
  created_by            UUID REFERENCES public.profiles(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One contract per project (for now)
  UNIQUE (company_id, project_id)
);

-- =============================================================================
-- 2. payment_schedule_sales — Zahlungsplan Verkauf (milestone-based Anzahlungen)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.payment_schedule_sales (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id            UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id            UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contract_id           UUID NOT NULL REFERENCES public.customer_contracts(id) ON DELETE CASCADE,
  project_id            UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  -- Milestone
  position              SMALLINT NOT NULL DEFAULT 1,
  milestone_name        TEXT NOT NULL,
  description           TEXT,
  -- Planned
  planned_amount        NUMERIC(14,2) NOT NULL,
  planned_date          DATE,
  planned_percentage    NUMERIC(5,2),  -- e.g. 30.00 = 30% of auftragswert
  -- Actual invoicing
  invoice_id            UUID REFERENCES public.invoices(id),  -- Bexio outgoing invoice
  invoiced_amount       NUMERIC(14,2),
  invoiced_at           DATE,
  -- Payment received
  payment_received      NUMERIC(14,2),
  payment_received_at   DATE,
  -- Liquidity link
  liquidity_event_id    UUID REFERENCES public.liquidity_event_instances(id),
  -- Status
  status                TEXT NOT NULL DEFAULT 'planned'
                          CHECK (status IN (
                            'planned',       -- Geplant
                            'invoiced',      -- Rechnung gestellt
                            'partially_paid',-- Teilweise bezahlt
                            'paid',          -- Vollständig bezahlt
                            'overdue',       -- Überfällig
                            'cancelled'      -- Storniert
                          )),
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 3. procurement_items — Einkaufsplan / Lieferplan
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.procurement_items (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id              UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id              UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id              UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  supplier_id             UUID REFERENCES public.suppliers(id),
  -- Item detail
  position                SMALLINT NOT NULL DEFAULT 1,
  category                TEXT NOT NULL DEFAULT 'material'
                            CHECK (category IN (
                              'material',        -- Module, Wechselrichter, Speicher, etc.
                              'subcontractor',   -- Subunternehmer (Gerüst, Elektro, etc.)
                              'equipment',       -- Werkzeug, Maschinen
                              'logistics',       -- Transport, Kran
                              'other'
                            )),
  description             TEXT NOT NULL,
  article_number          TEXT,
  quantity                NUMERIC(12,3) NOT NULL DEFAULT 1,
  unit                    TEXT NOT NULL DEFAULT 'Stk',
  unit_price              NUMERIC(14,2) NOT NULL,
  total_price             NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  currency                TEXT NOT NULL DEFAULT 'CHF',
  -- Delivery plan
  planned_order_date      DATE,
  planned_delivery_date   DATE,
  actual_order_date       DATE,
  actual_delivery_date    DATE,
  delivery_status         TEXT NOT NULL DEFAULT 'not_ordered'
                            CHECK (delivery_status IN (
                              'not_ordered',     -- Noch nicht bestellt
                              'ordered',         -- Bestellt
                              'confirmed',       -- Liefertermin bestätigt
                              'shipped',         -- Versendet
                              'delivered',       -- Geliefert
                              'partial',         -- Teillieferung
                              'cancelled'        -- Storniert
                            )),
  -- Payment (Einkauf-Seite)
  -- When delivered → "zahlungsfähig", actual payment tracked via invoices_incoming
  invoice_incoming_id     UUID REFERENCES public.invoices_incoming(id),
  payment_status          TEXT NOT NULL DEFAULT 'pending'
                            CHECK (payment_status IN (
                              'pending',         -- Noch nicht zahlungsfähig
                              'payable',         -- Zahlungsfähig (Lieferung erfolgt)
                              'invoiced',        -- Rechnung erhalten
                              'paid',            -- Bezahlt
                              'cancelled'
                            )),
  planned_payment_amount  NUMERIC(14,2),
  planned_payment_date    DATE,
  -- Liquidity link
  liquidity_event_id      UUID REFERENCES public.liquidity_event_instances(id),
  -- Tracking
  notes                   TEXT,
  created_by              UUID REFERENCES public.profiles(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 4. kalkulationen — Project cost breakdown / Kalkulation
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.kalkulationen (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id            UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id            UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id            UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  -- Version tracking (multiple Kalkulations per project possible)
  version               SMALLINT NOT NULL DEFAULT 1,
  version_name          TEXT,  -- e.g. "Erstangebot", "Nachtrag 1"
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  -- Revenue side
  auftragswert          NUMERIC(14,2),  -- from customer_contracts or manual
  -- Cost breakdown
  material_cost         NUMERIC(14,2) NOT NULL DEFAULT 0,
  labor_cost            NUMERIC(14,2) NOT NULL DEFAULT 0,
  subcontractor_cost    NUMERIC(14,2) NOT NULL DEFAULT 0,
  equipment_cost        NUMERIC(14,2) NOT NULL DEFAULT 0,
  logistics_cost        NUMERIC(14,2) NOT NULL DEFAULT 0,
  overhead_cost         NUMERIC(14,2) NOT NULL DEFAULT 0,
  other_cost            NUMERIC(14,2) NOT NULL DEFAULT 0,
  -- Computed totals (stored for performance, recalculated by trigger)
  total_cost            NUMERIC(14,2) GENERATED ALWAYS AS (
                          material_cost + labor_cost + subcontractor_cost +
                          equipment_cost + logistics_cost + overhead_cost + other_cost
                        ) STORED,
  rohertrag             NUMERIC(14,2) GENERATED ALWAYS AS (
                          COALESCE(auftragswert, 0) - (
                            material_cost + labor_cost + subcontractor_cost +
                            equipment_cost + logistics_cost + overhead_cost + other_cost
                          )
                        ) STORED,
  marge_prozent         NUMERIC(5,2) GENERATED ALWAYS AS (
                          CASE WHEN COALESCE(auftragswert, 0) > 0
                            THEN (
                              (COALESCE(auftragswert, 0) - (
                                material_cost + labor_cost + subcontractor_cost +
                                equipment_cost + logistics_cost + overhead_cost + other_cost
                              )) / auftragswert * 100
                            )
                            ELSE 0
                          END
                        ) STORED,
  -- Status
  status                TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN (
                            'draft',         -- Entwurf
                            'reviewed',      -- Geprüft
                            'approved',      -- Freigegeben
                            'locked'         -- Gesperrt (nach Auftrag)
                          )),
  approved_by           UUID REFERENCES public.profiles(id),
  approved_at           TIMESTAMPTZ,
  notes                 TEXT,
  created_by            UUID REFERENCES public.profiles(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Only one active Kalkulation per project
  UNIQUE (project_id, version)
);

-- =============================================================================
-- 5. Trigger: auto-validate payment schedule vs. auftragswert
-- =============================================================================

CREATE OR REPLACE FUNCTION public.validate_payment_schedule_total()
RETURNS TRIGGER AS $$
DECLARE
  v_contract_id UUID;
  v_auftragswert NUMERIC(14,2);
  v_schedule_sum NUMERIC(14,2);
BEGIN
  v_contract_id := COALESCE(NEW.contract_id, OLD.contract_id);

  SELECT auftragswert INTO v_auftragswert
  FROM public.customer_contracts
  WHERE id = v_contract_id;

  SELECT COALESCE(SUM(planned_amount), 0) INTO v_schedule_sum
  FROM public.payment_schedule_sales
  WHERE contract_id = v_contract_id
    AND status != 'cancelled';

  UPDATE public.customer_contracts
  SET schedule_amount_valid = (ABS(v_schedule_sum - v_auftragswert) < 0.01),
      schedule_deviation = v_schedule_sum - v_auftragswert
  WHERE id = v_contract_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_validate_schedule_total
  AFTER INSERT OR UPDATE OR DELETE ON public.payment_schedule_sales
  FOR EACH ROW EXECUTE FUNCTION public.validate_payment_schedule_total();

-- =============================================================================
-- 6. Trigger: auto-set payment_status to 'payable' when delivered
-- =============================================================================

CREATE OR REPLACE FUNCTION public.procurement_delivery_payable()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.delivery_status = 'delivered' AND OLD.delivery_status != 'delivered'
     AND NEW.payment_status = 'pending' THEN
    NEW.payment_status := 'payable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_procurement_delivery_payable
  BEFORE UPDATE ON public.procurement_items
  FOR EACH ROW EXECUTE FUNCTION public.procurement_delivery_payable();

-- =============================================================================
-- 7. updated_at triggers
-- =============================================================================

CREATE TRIGGER trg_customer_contracts_updated
  BEFORE UPDATE ON public.customer_contracts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_payment_schedule_sales_updated
  BEFORE UPDATE ON public.payment_schedule_sales
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_procurement_items_updated
  BEFORE UPDATE ON public.procurement_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_kalkulationen_updated
  BEFORE UPDATE ON public.kalkulationen
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 8. ROW LEVEL SECURITY — 4-tier pattern (enura, holding, company+permission, service)
-- =============================================================================

DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'customer_contracts',
    'payment_schedule_sales',
    'procurement_items',
    'kalkulationen'
  ]) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    -- Enura admin: full access
    EXECUTE format(
      'CREATE POLICY "fin_enura_%s" ON public.%I FOR ALL USING (public.is_enura_admin())',
      tbl, tbl);

    -- Holding admin: full access within holding
    EXECUTE format(
      'CREATE POLICY "fin_holding_%s" ON public.%I FOR ALL USING (holding_id = public.current_holding_id() AND public.is_holding_admin())',
      tbl, tbl);

    -- Company user with finanzplanung permission: write
    EXECUTE format(
      'CREATE POLICY "fin_company_write_%s" ON public.%I FOR ALL USING (company_id = public.current_company_id() AND public.has_permission(''module:finanzplanung:read''))',
      tbl, tbl);

    -- Company user with read permission: read-only
    EXECUTE format(
      'CREATE POLICY "fin_company_read_%s" ON public.%I FOR SELECT USING (company_id = public.current_company_id())',
      tbl, tbl);

    -- Service role: full bypass
    EXECUTE format(
      'CREATE POLICY "fin_service_%s" ON public.%I FOR ALL USING (current_setting(''role'') = ''service_role'') WITH CHECK (current_setting(''role'') = ''service_role'')',
      tbl, tbl);
  END LOOP;
END $$;

-- =============================================================================
-- 9. INDEXES
-- =============================================================================

-- customer_contracts
CREATE INDEX IF NOT EXISTS idx_cc_company_status
  ON public.customer_contracts (company_id, status);
CREATE INDEX IF NOT EXISTS idx_cc_project
  ON public.customer_contracts (project_id);

-- payment_schedule_sales
CREATE INDEX IF NOT EXISTS idx_pss_contract
  ON public.payment_schedule_sales (contract_id, position);
CREATE INDEX IF NOT EXISTS idx_pss_project
  ON public.payment_schedule_sales (project_id);
CREATE INDEX IF NOT EXISTS idx_pss_status
  ON public.payment_schedule_sales (company_id, status, planned_date)
  WHERE status NOT IN ('paid', 'cancelled');
CREATE INDEX IF NOT EXISTS idx_pss_overdue
  ON public.payment_schedule_sales (company_id, planned_date)
  WHERE status IN ('planned', 'invoiced') AND planned_date IS NOT NULL;

-- procurement_items
CREATE INDEX IF NOT EXISTS idx_proc_project
  ON public.procurement_items (project_id, position);
CREATE INDEX IF NOT EXISTS idx_proc_supplier
  ON public.procurement_items (supplier_id, company_id)
  WHERE supplier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proc_delivery
  ON public.procurement_items (company_id, delivery_status, planned_delivery_date)
  WHERE delivery_status NOT IN ('delivered', 'cancelled');
CREATE INDEX IF NOT EXISTS idx_proc_payment
  ON public.procurement_items (company_id, payment_status)
  WHERE payment_status IN ('payable', 'invoiced');

-- kalkulationen
CREATE INDEX IF NOT EXISTS idx_kalk_project
  ON public.kalkulationen (project_id, is_active);
CREATE INDEX IF NOT EXISTS idx_kalk_company
  ON public.kalkulationen (company_id, status);

COMMIT;
