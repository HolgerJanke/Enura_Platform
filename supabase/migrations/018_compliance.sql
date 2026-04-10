-- =============================================================================
-- Migration 018: Compliance architecture
-- Tables: compliance_rules, compliance_checks, compliance_documents, certifications
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. compliance_rules — master catalogue of rules
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.compliance_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  trigger_event TEXT NOT NULL CHECK (trigger_event IN (
    'connector_created',
    'company_created',
    'holding_created',
    'document_uploaded',
    'secret_rotated',
    'manual',
    'scheduled'
  )),
  trigger_filter JSONB NOT NULL DEFAULT '{}',
  requirement TEXT NOT NULL DEFAULT '',
  deadline_days INTEGER NOT NULL DEFAULT 30,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  legal_basis TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 2. compliance_checks — individual check instances
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.compliance_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES public.compliance_rules(id) ON DELETE CASCADE,
  rule_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'fulfilled', 'overdue', 'waived')),
  triggered_by TEXT NOT NULL DEFAULT 'system',
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_at TIMESTAMPTZ NOT NULL,
  fulfilled_at TIMESTAMPTZ,
  fulfilled_by UUID REFERENCES auth.users(id),
  waived_by UUID REFERENCES auth.users(id),
  waive_reason TEXT,
  waive_expires_at DATE,
  notes TEXT,
  notified_at TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- 3. compliance_documents — uploaded evidence / contracts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.compliance_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  check_id UUID REFERENCES public.compliance_checks(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'avv', 'dpa', 'dsfa', 'tom', 'certificate',
    'audit_report', 'vvt', 'consent_form', 'other'
  )),
  title TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  valid_from DATE,
  expires_at DATE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 4. certifications — certification roadmap
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  level TEXT NOT NULL CHECK (level IN ('platform', 'holding', 'company')),
  certification TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'certified', 'expired')),
  certified_at DATE,
  expires_at DATE,
  document_id UUID REFERENCES public.compliance_documents(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- RLS
-- =============================================================================

ALTER TABLE public.compliance_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;

-- compliance_rules: read-only for holding admins + enura admins
CREATE POLICY "enura_admin_compliance_rules" ON public.compliance_rules
  FOR ALL USING (public.is_enura_admin());

CREATE POLICY "holding_admin_compliance_rules" ON public.compliance_rules
  FOR SELECT USING (public.is_holding_admin());

CREATE POLICY "service_compliance_rules" ON public.compliance_rules
  FOR ALL USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');

-- compliance_checks: holding-scoped + enura admin + company read
CREATE POLICY "enura_admin_compliance_checks" ON public.compliance_checks
  FOR ALL USING (public.is_enura_admin());

CREATE POLICY "holding_admin_compliance_checks" ON public.compliance_checks
  FOR ALL USING (holding_id = public.current_holding_id() AND public.is_holding_admin())
  WITH CHECK (holding_id = public.current_holding_id() AND public.is_holding_admin());

CREATE POLICY "company_user_compliance_checks" ON public.compliance_checks
  FOR SELECT USING (company_id = public.current_company_id());

CREATE POLICY "service_compliance_checks" ON public.compliance_checks
  FOR ALL USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');

-- compliance_documents: holding-scoped + enura admin
CREATE POLICY "enura_admin_compliance_documents" ON public.compliance_documents
  FOR ALL USING (public.is_enura_admin());

CREATE POLICY "holding_admin_compliance_documents" ON public.compliance_documents
  FOR ALL USING (holding_id = public.current_holding_id() AND public.is_holding_admin())
  WITH CHECK (holding_id = public.current_holding_id() AND public.is_holding_admin());

CREATE POLICY "service_compliance_documents" ON public.compliance_documents
  FOR ALL USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');

-- certifications: holding-scoped + enura admin
CREATE POLICY "enura_admin_certifications" ON public.certifications
  FOR ALL USING (public.is_enura_admin());

CREATE POLICY "holding_admin_certifications" ON public.certifications
  FOR ALL USING (holding_id = public.current_holding_id() AND public.is_holding_admin())
  WITH CHECK (holding_id = public.current_holding_id() AND public.is_holding_admin());

CREATE POLICY "service_certifications" ON public.certifications
  FOR ALL USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');

-- =============================================================================
-- Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_compliance_checks_holding_status
  ON public.compliance_checks (holding_id, status);

CREATE INDEX IF NOT EXISTS idx_compliance_checks_company_status
  ON public.compliance_checks (company_id, status)
  WHERE company_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_compliance_checks_due_at
  ON public.compliance_checks (due_at)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_compliance_documents_holding
  ON public.compliance_documents (holding_id);

CREATE INDEX IF NOT EXISTS idx_compliance_documents_expires
  ON public.compliance_documents (expires_at)
  WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_certifications_holding_status
  ON public.certifications (holding_id, status);

CREATE INDEX IF NOT EXISTS idx_certifications_expires
  ON public.certifications (expires_at)
  WHERE expires_at IS NOT NULL;

-- =============================================================================
-- Seed: 7 default compliance rules
-- =============================================================================

INSERT INTO public.compliance_rules (rule_code, title, description, trigger_event, trigger_filter, requirement, deadline_days, severity, legal_basis) VALUES
(
  'THIRD_COUNTRY_SCC',
  'Standardvertragsklauseln für Drittlandtransfer',
  'Bei Anbindung eines Connectors mit Datenverarbeitung außerhalb der EU/CH müssen SCC abgeschlossen werden.',
  'connector_created',
  '{"third_country": true}',
  'SCC-Vertrag mit dem Auftragsverarbeiter abschließen und als Dokument hochladen.',
  30,
  'critical',
  'Art. 46 Abs. 2 lit. c DSGVO / Art. 16 Abs. 2 lit. d DSG'
),
(
  'DPA_REQUIRED',
  'Auftragsverarbeitungsvertrag (AVV) erforderlich',
  'Jeder externe Datenverarbeiter (Connector) erfordert einen AVV.',
  'connector_created',
  '{}',
  'AVV mit dem Anbieter abschließen und als Dokument (Typ: avv) hochladen.',
  14,
  'critical',
  'Art. 28 DSGVO / Art. 9 DSG'
),
(
  'AUDIO_CONSENT',
  'Einwilligung für Gesprächsaufzeichnung',
  'Vor Aktivierung der 3CX-Aufzeichnung muss die Einwilligung der Gesprächsteilnehmer sichergestellt sein.',
  'connector_created',
  '{"connector_type": "3cx"}',
  'Einwilligungsformular konfigurieren und Nachweis hochladen (Typ: consent_form).',
  7,
  'critical',
  'Art. 6 Abs. 1 lit. a DSGVO / Art. 179quater StGB (CH)'
),
(
  'FINANCIAL_RETENTION',
  'Aufbewahrungspflicht Finanzdaten',
  'Finanzdaten (Rechnungen, Zahlungen) müssen mindestens 10 Jahre aufbewahrt werden.',
  'scheduled',
  '{"schedule": "yearly"}',
  'Jährliche Prüfung der Archivierung und Löschfristen für Finanzdaten.',
  90,
  'warning',
  'Art. 958f OR (CH) / § 147 AO (DE)'
),
(
  'OAUTH_SECRET_ROTATION',
  'OAuth-Secret-Rotation',
  'OAuth-Client-Secrets müssen regelmäßig rotiert werden.',
  'secret_rotated',
  '{"secret_type": "oauth2_token"}',
  'Secret rotieren und neuen Token im Connector hinterlegen.',
  90,
  'warning',
  'Best Practice — OWASP Secret Management'
),
(
  'NEW_HOLDING_BASELINE',
  'Datenschutz-Grundausstattung für neues Holding',
  'Beim Erstellen eines Holdings müssen grundlegende Datenschutzdokumente vorhanden sein (TOM, VVT).',
  'holding_created',
  '{}',
  'TOM-Dokument und Verzeichnis der Verarbeitungstätigkeiten (VVT) hochladen.',
  60,
  'critical',
  'Art. 30 DSGVO / Art. 12 DSG'
),
(
  'HIGH_RISK_DSFA',
  'Datenschutz-Folgenabschätzung (DSFA)',
  'Bei Verarbeitung mit hohem Risiko (z.B. KI-Analyse von Gesprächen) ist eine DSFA erforderlich.',
  'manual',
  '{}',
  'DSFA durchführen und als Dokument (Typ: dsfa) hochladen.',
  90,
  'critical',
  'Art. 35 DSGVO / Art. 22 DSG'
)
ON CONFLICT (rule_code) DO NOTHING;
