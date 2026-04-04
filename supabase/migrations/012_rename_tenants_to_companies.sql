-- ============================================================
-- Migration 012 — Rename tenants → companies
-- Renames table, columns, and adds holding_id everywhere.
-- ============================================================

-- 1. Rename the table
ALTER TABLE IF EXISTS public.tenants RENAME TO companies;

-- 2. Add holding_id to companies
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS holding_id UUID REFERENCES public.holdings(id);

-- 3. Create default holding for existing data
INSERT INTO public.holdings (id, name, slug, status)
VALUES ('00000000-0000-0000-0000-000000000010', 'Default Holding', 'default-holding', 'active')
ON CONFLICT (id) DO NOTHING;

-- Assign all existing companies to default holding
UPDATE public.companies SET holding_id = '00000000-0000-0000-0000-000000000010' WHERE holding_id IS NULL;
ALTER TABLE public.companies ALTER COLUMN holding_id SET NOT NULL;

-- 4. Rename tenant_id → company_id and add holding_id on all tables

-- profiles
ALTER TABLE public.profiles RENAME COLUMN tenant_id TO company_id;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS holding_id UUID REFERENCES public.holdings(id);
UPDATE public.profiles p SET holding_id = c.holding_id FROM public.companies c WHERE c.id = p.company_id;

-- roles
ALTER TABLE public.roles RENAME COLUMN tenant_id TO company_id;
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS holding_id UUID;
UPDATE public.roles r SET holding_id = c.holding_id FROM public.companies c WHERE c.id = r.company_id;

-- tenant_brandings → company_branding
ALTER TABLE IF EXISTS public.tenant_brandings RENAME TO company_branding;
ALTER TABLE public.company_branding RENAME COLUMN tenant_id TO company_id;
ALTER TABLE public.company_branding ADD COLUMN IF NOT EXISTS holding_id UUID;
UPDATE public.company_branding cb SET holding_id = c.holding_id FROM public.companies c WHERE c.id = cb.company_id;

-- connectors
ALTER TABLE public.connectors RENAME COLUMN tenant_id TO company_id;
ALTER TABLE public.connectors ADD COLUMN IF NOT EXISTS holding_id UUID;
UPDATE public.connectors co SET holding_id = c.holding_id FROM public.companies c WHERE c.id = co.company_id;

-- connector_sync_log
ALTER TABLE public.connector_sync_log RENAME COLUMN tenant_id TO company_id;
ALTER TABLE public.connector_sync_log ADD COLUMN IF NOT EXISTS holding_id UUID;
UPDATE public.connector_sync_log csl SET holding_id = co.holding_id FROM public.connectors co WHERE co.id = csl.connector_id;

-- team_members
ALTER TABLE public.team_members RENAME COLUMN tenant_id TO company_id;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS holding_id UUID;
UPDATE public.team_members tm SET holding_id = c.holding_id FROM public.companies c WHERE c.id = tm.company_id;

-- leads
ALTER TABLE public.leads RENAME COLUMN tenant_id TO company_id;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS holding_id UUID;
UPDATE public.leads l SET holding_id = c.holding_id FROM public.companies c WHERE c.id = l.company_id;

-- offers
ALTER TABLE public.offers RENAME COLUMN tenant_id TO company_id;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS holding_id UUID;
UPDATE public.offers o SET holding_id = c.holding_id FROM public.companies c WHERE c.id = o.company_id;

-- offer_notes
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='offer_notes' AND column_name='tenant_id') THEN
    ALTER TABLE public.offer_notes RENAME COLUMN tenant_id TO company_id;
  END IF;
END $$;
ALTER TABLE public.offer_notes ADD COLUMN IF NOT EXISTS holding_id UUID;
UPDATE public.offer_notes on2 SET holding_id = o.holding_id FROM public.offers o WHERE o.id = on2.offer_id;

-- calls
ALTER TABLE public.calls RENAME COLUMN tenant_id TO company_id;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS holding_id UUID;
UPDATE public.calls ca SET holding_id = c.holding_id FROM public.companies c WHERE c.id = ca.company_id;

-- call_analysis
ALTER TABLE public.call_analysis RENAME COLUMN tenant_id TO company_id;
ALTER TABLE public.call_analysis ADD COLUMN IF NOT EXISTS holding_id UUID;
UPDATE public.call_analysis ca SET holding_id = cl.holding_id FROM public.calls cl WHERE cl.id = ca.call_id;

-- call_scripts
ALTER TABLE public.call_scripts RENAME COLUMN tenant_id TO company_id;
ALTER TABLE public.call_scripts ADD COLUMN IF NOT EXISTS holding_id UUID;
UPDATE public.call_scripts cs SET holding_id = c.holding_id FROM public.companies c WHERE c.id = cs.company_id;

-- invoices
ALTER TABLE public.invoices RENAME COLUMN tenant_id TO company_id;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS holding_id UUID;
UPDATE public.invoices i SET holding_id = c.holding_id FROM public.companies c WHERE c.id = i.company_id;

-- payments
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='tenant_id') THEN
    ALTER TABLE public.payments RENAME COLUMN tenant_id TO company_id;
  END IF;
END $$;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS holding_id UUID;
UPDATE public.payments p SET holding_id = i.holding_id FROM public.invoices i WHERE i.id = p.invoice_id;

-- cashflow_uploads
ALTER TABLE public.cashflow_uploads RENAME COLUMN tenant_id TO company_id;
ALTER TABLE public.cashflow_uploads ADD COLUMN IF NOT EXISTS holding_id UUID;
UPDATE public.cashflow_uploads cu SET holding_id = c.holding_id FROM public.companies c WHERE c.id = cu.company_id;

-- cashflow_entries
ALTER TABLE public.cashflow_entries RENAME COLUMN tenant_id TO company_id;
ALTER TABLE public.cashflow_entries ADD COLUMN IF NOT EXISTS holding_id UUID;

-- projects
ALTER TABLE public.projects RENAME COLUMN tenant_id TO company_id;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS holding_id UUID;
UPDATE public.projects p SET holding_id = c.holding_id FROM public.companies c WHERE c.id = p.company_id;

-- project_phase_history
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='project_phase_history' AND column_name='tenant_id') THEN
    ALTER TABLE public.project_phase_history RENAME COLUMN tenant_id TO company_id;
  END IF;
END $$;
ALTER TABLE public.project_phase_history ADD COLUMN IF NOT EXISTS holding_id UUID;
UPDATE public.project_phase_history pph SET holding_id = p.holding_id FROM public.projects p WHERE p.id = pph.project_id;

-- phase_definitions
ALTER TABLE public.phase_definitions RENAME COLUMN tenant_id TO company_id;
ALTER TABLE public.phase_definitions ADD COLUMN IF NOT EXISTS holding_id UUID;
UPDATE public.phase_definitions pd SET holding_id = c.holding_id FROM public.companies c WHERE c.id = pd.company_id;

-- calendar_events
ALTER TABLE public.calendar_events RENAME COLUMN tenant_id TO company_id;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS holding_id UUID;
UPDATE public.calendar_events ce SET holding_id = c.holding_id FROM public.companies c WHERE c.id = ce.company_id;

-- kpi_snapshots
ALTER TABLE public.kpi_snapshots RENAME COLUMN tenant_id TO company_id;
ALTER TABLE public.kpi_snapshots ADD COLUMN IF NOT EXISTS holding_id UUID;
UPDATE public.kpi_snapshots ks SET holding_id = c.holding_id FROM public.companies c WHERE c.id = ks.company_id;

-- audit_log
ALTER TABLE public.audit_log RENAME COLUMN tenant_id TO company_id;
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS holding_id UUID;

-- daily_reports
ALTER TABLE public.daily_reports RENAME COLUMN tenant_id TO company_id;
ALTER TABLE public.daily_reports ADD COLUMN IF NOT EXISTS holding_id UUID;
UPDATE public.daily_reports dr SET holding_id = c.holding_id FROM public.companies c WHERE c.id = dr.company_id;

-- anomalies
ALTER TABLE public.anomalies RENAME COLUMN tenant_id TO company_id;
ALTER TABLE public.anomalies ADD COLUMN IF NOT EXISTS holding_id UUID;
UPDATE public.anomalies a SET holding_id = c.holding_id FROM public.companies c WHERE c.id = a.company_id;

-- tenant_settings → company_settings
ALTER TABLE IF EXISTS public.tenant_settings RENAME TO company_settings;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_settings' AND column_name='tenant_id') THEN
    ALTER TABLE public.company_settings RENAME COLUMN tenant_id TO company_id;
  END IF;
END $$;
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS holding_id UUID;
UPDATE public.company_settings cs SET holding_id = c.holding_id FROM public.companies c WHERE c.id = cs.company_id;

-- whatsapp_messages (Phase 6)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'whatsapp_messages') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='whatsapp_messages' AND column_name='tenant_id') THEN
      ALTER TABLE public.whatsapp_messages RENAME COLUMN tenant_id TO company_id;
    END IF;
    ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS holding_id UUID;
    UPDATE public.whatsapp_messages wm SET holding_id = c.holding_id FROM public.companies c WHERE c.id = wm.company_id;
  END IF;
END $$;

-- email_activity (Phase 6)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'email_activity') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='email_activity' AND column_name='tenant_id') THEN
      ALTER TABLE public.email_activity RENAME COLUMN tenant_id TO company_id;
    END IF;
    ALTER TABLE public.email_activity ADD COLUMN IF NOT EXISTS holding_id UUID;
    UPDATE public.email_activity ea SET holding_id = c.holding_id FROM public.companies c WHERE c.id = ea.company_id;
  END IF;
END $$;

-- transcription_usage
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'transcription_usage') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transcription_usage' AND column_name='tenant_id') THEN
      ALTER TABLE public.transcription_usage RENAME COLUMN tenant_id TO company_id;
    END IF;
    ALTER TABLE public.transcription_usage ADD COLUMN IF NOT EXISTS holding_id UUID;
  END IF;
END $$;

-- 5. FK from domain_mappings to companies
DO $$ BEGIN
  ALTER TABLE public.domain_mappings
    ADD CONSTRAINT domain_mappings_company_fk
    FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. Holding_id indexes
CREATE INDEX IF NOT EXISTS idx_companies_holding       ON public.companies (holding_id);
CREATE INDEX IF NOT EXISTS idx_profiles_holding        ON public.profiles (holding_id);
CREATE INDEX IF NOT EXISTS idx_leads_holding           ON public.leads (holding_id, company_id);
CREATE INDEX IF NOT EXISTS idx_offers_holding          ON public.offers (holding_id, company_id);
CREATE INDEX IF NOT EXISTS idx_projects_holding        ON public.projects (holding_id, company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_holding        ON public.invoices (holding_id, company_id);
CREATE INDEX IF NOT EXISTS idx_calls_holding           ON public.calls (holding_id, company_id);
CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_holding   ON public.kpi_snapshots (holding_id, company_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_holding       ON public.audit_log (holding_id, company_id);
