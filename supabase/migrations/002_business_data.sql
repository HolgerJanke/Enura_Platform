-- =============================================================================
-- Migration 002: Business Data Tables (Phase 3)
-- Enura Group Multi-Tenant BI Platform
--
-- Contains: All remaining business tables not in 001 — connectors, team_members,
--           leads, offers, calls, call_analysis, invoices, projects, phases,
--           KPI snapshots, cashflow, calendar events, payments, offer_notes,
--           call_scripts, cashflow_uploads, project_phase_history.
-- Idempotent: safe to run multiple times.
-- =============================================================================

-- =============================================================================
-- 1. TimescaleDB Extension (optional — falls back gracefully)
-- =============================================================================

DO $$ BEGIN
    CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'TimescaleDB extension not available — will use BRIN indexes as fallback.';
END $$;

-- =============================================================================
-- 2. Enums (only those NOT created in 001)
-- =============================================================================

DO $$ BEGIN CREATE TYPE lead_status AS ENUM ('new', 'contacted', 'qualified', 'appointment_set', 'won', 'lost', 'invalid'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE lead_source AS ENUM ('website', 'referral', 'partner', 'advertising', 'cold_call', 'leadnotes', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE offer_status AS ENUM ('draft', 'sent', 'negotiating', 'won', 'lost', 'expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE call_direction AS ENUM ('inbound', 'outbound'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE call_status AS ENUM ('answered', 'missed', 'voicemail', 'busy', 'failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled', 'partially_paid'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE project_status AS ENUM ('active', 'on_hold', 'completed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE connector_type AS ENUM ('reonic', '3cx', 'bexio', 'google_calendar', 'leadnotes', 'whatsapp', 'gmail'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE connector_status AS ENUM ('active', 'paused', 'error', 'disconnected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE sync_status AS ENUM ('running', 'success', 'error'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE cashflow_type AS ENUM ('income', 'expense'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 3. Tables
-- =============================================================================

-- ---- Connectors ----
CREATE TABLE IF NOT EXISTS connectors (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    type                  connector_type NOT NULL,
    name                  TEXT NOT NULL,
    credentials           JSONB NOT NULL DEFAULT '{}',
    config                JSONB NOT NULL DEFAULT '{}',
    status                connector_status NOT NULL DEFAULT 'disconnected',
    last_synced_at        TIMESTAMPTZ,
    last_error            TEXT,
    sync_interval_minutes INTEGER NOT NULL DEFAULT 15,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, type)
);

-- ---- Connector Sync Log ----
CREATE TABLE IF NOT EXISTS connector_sync_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connector_id    UUID NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    status          sync_status NOT NULL,
    records_synced  INTEGER NOT NULL DEFAULT 0,
    error_message   TEXT,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Team Members ----
CREATE TABLE IF NOT EXISTS team_members (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    profile_id        UUID REFERENCES profiles(id),
    external_id       TEXT,
    first_name        TEXT NOT NULL,
    last_name         TEXT NOT NULL,
    display_name      TEXT GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
    email             TEXT,
    phone             TEXT,
    role_type         TEXT NOT NULL,
    team              TEXT,
    is_active         BOOLEAN NOT NULL DEFAULT true,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Leads ----
CREATE TABLE IF NOT EXISTS leads (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    external_id     TEXT,
    first_name      TEXT,
    last_name       TEXT,
    email           TEXT,
    phone           TEXT,
    address_street  TEXT,
    address_zip     TEXT,
    address_city    TEXT,
    address_canton  TEXT,
    status          lead_status NOT NULL DEFAULT 'new',
    source          lead_source NOT NULL DEFAULT 'other',
    setter_id       UUID REFERENCES team_members(id),
    notes           TEXT,
    qualified_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Offers ----
CREATE TABLE IF NOT EXISTS offers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    external_id     TEXT,
    lead_id         UUID REFERENCES leads(id),
    berater_id      UUID REFERENCES team_members(id),
    title           TEXT NOT NULL,
    description     TEXT,
    amount_chf      DECIMAL(12,2) NOT NULL DEFAULT 0,
    status          offer_status NOT NULL DEFAULT 'draft',
    sent_at         TIMESTAMPTZ,
    decided_at      TIMESTAMPTZ,
    valid_until     DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Calls (composite PK for TimescaleDB partitioning) ----
CREATE TABLE IF NOT EXISTS calls (
    id              UUID NOT NULL DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    external_id     TEXT,
    team_member_id  UUID REFERENCES team_members(id),
    direction       call_direction NOT NULL,
    status          call_status NOT NULL,
    caller_number   TEXT,
    callee_number   TEXT,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    recording_url   TEXT,
    started_at      TIMESTAMPTZ NOT NULL,
    ended_at        TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, started_at)
);

-- ---- Call Analysis ----
CREATE TABLE IF NOT EXISTS call_analysis (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    call_id              UUID NOT NULL,
    call_started_at      TIMESTAMPTZ NOT NULL,
    transcript           TEXT,
    greeting_score       SMALLINT CHECK (greeting_score BETWEEN 1 AND 10),
    needs_analysis_score SMALLINT CHECK (needs_analysis_score BETWEEN 1 AND 10),
    presentation_score   SMALLINT CHECK (presentation_score BETWEEN 1 AND 10),
    closing_score        SMALLINT CHECK (closing_score BETWEEN 1 AND 10),
    overall_score        SMALLINT CHECK (overall_score BETWEEN 1 AND 10),
    suggestions          JSONB,
    script_adherence     DECIMAL(5,2),
    model_version        TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
    analyzed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (call_id, call_started_at) REFERENCES calls(id, started_at) ON DELETE CASCADE
);

-- ---- Invoices ----
CREATE TABLE IF NOT EXISTS invoices (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    external_id       TEXT,
    offer_id          UUID REFERENCES offers(id),
    project_id        UUID,  -- FK added after projects table creation
    invoice_number    TEXT NOT NULL,
    customer_name     TEXT NOT NULL,
    amount_chf        DECIMAL(12,2) NOT NULL,
    tax_chf           DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_chf         DECIMAL(12,2) NOT NULL,
    status            invoice_status NOT NULL DEFAULT 'draft',
    issued_at         DATE NOT NULL,
    due_at            DATE NOT NULL,
    paid_at           DATE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Phase Definitions (27-phase Kanban) ----
CREATE TABLE IF NOT EXISTS phase_definitions (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    phase_number         SMALLINT NOT NULL,
    name                 TEXT NOT NULL,
    description          TEXT,
    color                TEXT,
    stall_threshold_days INTEGER DEFAULT 7,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, phase_number)
);

-- ---- Projects ----
CREATE TABLE IF NOT EXISTS projects (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    external_id       TEXT,
    lead_id           UUID REFERENCES leads(id),
    offer_id          UUID REFERENCES offers(id),
    berater_id        UUID REFERENCES team_members(id),
    title             TEXT NOT NULL,
    customer_name     TEXT NOT NULL,
    address_street    TEXT,
    address_zip       TEXT,
    address_city      TEXT,
    current_phase     INTEGER NOT NULL DEFAULT 1,
    phase_id          UUID REFERENCES phase_definitions(id),
    status            project_status NOT NULL DEFAULT 'active',
    phase_entered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    installation_date DATE,
    completion_date   DATE,
    notes             TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add project_id FK to invoices now that projects exists
DO $$ BEGIN
    ALTER TABLE invoices ADD CONSTRAINT invoices_project_id_fkey
        FOREIGN KEY (project_id) REFERENCES projects(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---- Project Phase History ----
CREATE TABLE IF NOT EXISTS project_phase_history (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    from_phase  INTEGER,
    to_phase    INTEGER NOT NULL,
    changed_by  UUID REFERENCES profiles(id),
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- KPI Snapshots (composite PK for TimescaleDB) ----
CREATE TABLE IF NOT EXISTS kpi_snapshots (
    id              UUID NOT NULL DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    snapshot_type   TEXT NOT NULL,
    entity_id       UUID,
    period_date     DATE NOT NULL,
    metrics         JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, period_date)
);

-- ---- Cashflow Entries (composite PK for TimescaleDB) ----
CREATE TABLE IF NOT EXISTS cashflow_entries (
    id              UUID NOT NULL DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    entry_date      DATE NOT NULL,
    type            cashflow_type NOT NULL,
    category        TEXT NOT NULL,
    description     TEXT,
    amount_chf      DECIMAL(12,2) NOT NULL,
    source          TEXT NOT NULL DEFAULT 'manual',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, entry_date)
);

-- ---- Calendar Events (composite PK for TimescaleDB) ----
CREATE TABLE IF NOT EXISTS calendar_events (
    id              UUID NOT NULL DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    external_id     TEXT,
    team_member_id  UUID REFERENCES team_members(id),
    title           TEXT NOT NULL,
    description     TEXT,
    location        TEXT,
    starts_at       TIMESTAMPTZ NOT NULL,
    ends_at         TIMESTAMPTZ NOT NULL,
    all_day         BOOLEAN NOT NULL DEFAULT false,
    event_type      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, starts_at)
);

-- ---- Payments ----
CREATE TABLE IF NOT EXISTS payments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    amount_chf      DECIMAL(12,2) NOT NULL,
    payment_date    DATE NOT NULL,
    payment_method  TEXT,
    reference       TEXT,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Cashflow Uploads (tracks Excel uploads) ----
CREATE TABLE IF NOT EXISTS cashflow_uploads (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    uploaded_by     UUID REFERENCES profiles(id),
    file_name       TEXT NOT NULL,
    file_url        TEXT NOT NULL,
    file_size_bytes INTEGER,
    rows_imported   INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'pending',
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Offer Notes ----
CREATE TABLE IF NOT EXISTS offer_notes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    offer_id        UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
    author_id       UUID REFERENCES profiles(id),
    content         TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Call Scripts ----
CREATE TABLE IF NOT EXISTS call_scripts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    content         TEXT NOT NULL,
    version         INTEGER NOT NULL DEFAULT 1,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_by      UUID REFERENCES profiles(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 4. TimescaleDB Hypertables (with fallback to BRIN indexes)
-- =============================================================================

-- calls → hypertable on started_at
DO $$ BEGIN
    PERFORM create_hypertable('calls', 'started_at', if_not_exists => TRUE);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'TimescaleDB not available for calls, using BRIN index instead.';
    CREATE INDEX IF NOT EXISTS idx_calls_started_at_brin ON calls USING BRIN (started_at);
END $$;

-- kpi_snapshots → hypertable on period_date
DO $$ BEGIN
    PERFORM create_hypertable('kpi_snapshots', 'period_date', if_not_exists => TRUE);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'TimescaleDB not available for kpi_snapshots, using BRIN index instead.';
    CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_period_date_brin ON kpi_snapshots USING BRIN (period_date);
END $$;

-- cashflow_entries → hypertable on entry_date
DO $$ BEGIN
    PERFORM create_hypertable('cashflow_entries', 'entry_date', if_not_exists => TRUE);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'TimescaleDB not available for cashflow_entries, using BRIN index instead.';
    CREATE INDEX IF NOT EXISTS idx_cashflow_entries_entry_date_brin ON cashflow_entries USING BRIN (entry_date);
END $$;

-- calendar_events → hypertable on starts_at
DO $$ BEGIN
    PERFORM create_hypertable('calendar_events', 'starts_at', if_not_exists => TRUE);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'TimescaleDB not available for calendar_events, using BRIN index instead.';
    CREATE INDEX IF NOT EXISTS idx_calendar_events_starts_at_brin ON calendar_events USING BRIN (starts_at);
END $$;

-- audit_log → convert existing table to hypertable (already exists from 001)
-- First, alter audit_log to use composite PK if it doesn't already
DO $$ BEGIN
    -- Check if audit_log already has a composite PK (id, created_at)
    -- If it has a simple PK on id only, we need to rebuild it
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'audit_log'
        AND tc.constraint_type = 'PRIMARY KEY'
        AND kcu.column_name = 'id'
        AND NOT EXISTS (
            SELECT 1 FROM information_schema.key_column_usage kcu2
            WHERE kcu2.constraint_name = tc.constraint_name
            AND kcu2.column_name = 'created_at'
        )
    ) THEN
        -- Drop old PK and recreate as composite
        ALTER TABLE audit_log DROP CONSTRAINT audit_log_pkey;
        ALTER TABLE audit_log ADD PRIMARY KEY (id, created_at);
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'audit_log PK already composite or cannot be altered: %', SQLERRM;
END $$;

DO $$ BEGIN
    PERFORM create_hypertable('audit_log', 'created_at', if_not_exists => TRUE, migrate_data => TRUE);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'TimescaleDB not available for audit_log, using BRIN index instead.';
    CREATE INDEX IF NOT EXISTS idx_audit_log_created_at_brin ON audit_log USING BRIN (created_at);
END $$;

-- =============================================================================
-- 5. Indexes
-- =============================================================================

-- team_members
CREATE INDEX IF NOT EXISTS idx_team_members_tenant ON team_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_team_members_profile ON team_members(profile_id);
CREATE INDEX IF NOT EXISTS idx_team_members_external ON team_members(external_id);

-- leads
CREATE INDEX IF NOT EXISTS idx_leads_tenant ON leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_setter ON leads(setter_id);
CREATE INDEX IF NOT EXISTS idx_leads_external ON leads(external_id);

-- offers
CREATE INDEX IF NOT EXISTS idx_offers_tenant ON offers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_offers_lead ON offers(lead_id);
CREATE INDEX IF NOT EXISTS idx_offers_berater ON offers(berater_id);
CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(tenant_id, status);

-- calls
CREATE INDEX IF NOT EXISTS idx_calls_tenant ON calls(tenant_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_member ON calls(team_member_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_external ON calls(external_id);

-- call_analysis
CREATE INDEX IF NOT EXISTS idx_call_analysis_tenant ON call_analysis(tenant_id);
CREATE INDEX IF NOT EXISTS idx_call_analysis_call ON call_analysis(call_id);

-- invoices
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_project ON invoices(project_id);

-- projects
CREATE INDEX IF NOT EXISTS idx_projects_tenant ON projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_projects_phase ON projects(phase_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_projects_current_phase ON projects(tenant_id, current_phase);
CREATE INDEX IF NOT EXISTS idx_projects_berater ON projects(berater_id);

-- project_phase_history
CREATE INDEX IF NOT EXISTS idx_phase_history_project ON project_phase_history(project_id);
CREATE INDEX IF NOT EXISTS idx_phase_history_tenant ON project_phase_history(tenant_id);

-- kpi_snapshots
CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_lookup ON kpi_snapshots(tenant_id, snapshot_type, entity_id, period_date DESC);

-- cashflow_entries
CREATE INDEX IF NOT EXISTS idx_cashflow_tenant ON cashflow_entries(tenant_id, entry_date DESC);

-- calendar_events
CREATE INDEX IF NOT EXISTS idx_calendar_tenant ON calendar_events(tenant_id, starts_at DESC);
CREATE INDEX IF NOT EXISTS idx_calendar_member ON calendar_events(team_member_id, starts_at DESC);

-- connector_sync_log
CREATE INDEX IF NOT EXISTS idx_sync_log_connector ON connector_sync_log(connector_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_log_tenant ON connector_sync_log(tenant_id);

-- payments
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(tenant_id, payment_date DESC);

-- cashflow_uploads
CREATE INDEX IF NOT EXISTS idx_cashflow_uploads_tenant ON cashflow_uploads(tenant_id);

-- offer_notes
CREATE INDEX IF NOT EXISTS idx_offer_notes_offer ON offer_notes(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_notes_tenant ON offer_notes(tenant_id);

-- call_scripts
CREATE INDEX IF NOT EXISTS idx_call_scripts_tenant ON call_scripts(tenant_id);

-- =============================================================================
-- 6. Triggers — updated_at
-- =============================================================================

DROP TRIGGER IF EXISTS set_updated_at ON team_members;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON team_members FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON leads;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON offers;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON offers FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON invoices;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON projects;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON connectors;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON connectors FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON offer_notes;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON offer_notes FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON call_scripts;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON call_scripts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- 7. Phase Transition Trigger
-- =============================================================================

CREATE OR REPLACE FUNCTION log_phase_transition()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.current_phase IS DISTINCT FROM NEW.current_phase THEN
        INSERT INTO project_phase_history (project_id, tenant_id, from_phase, to_phase, changed_by)
        VALUES (
            NEW.id,
            NEW.tenant_id,
            OLD.current_phase,
            NEW.current_phase,
            COALESCE(current_setting('app.current_user_id', true)::uuid, NULL)
        );
        NEW.phase_entered_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_phase_transition ON projects;
CREATE TRIGGER trg_log_phase_transition
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION log_phase_transition();

-- =============================================================================
-- 8. Seed Phase Definitions Function (called when tenant is created)
-- =============================================================================

CREATE OR REPLACE FUNCTION seed_tenant_phases(p_tenant_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO phase_definitions (tenant_id, phase_number, name, description, stall_threshold_days) VALUES
        (p_tenant_id,  1, 'Auftrag eingegangen',   'Neuer Auftrag im System erfasst', 3),
        (p_tenant_id,  2, 'Technische Prüfung',    'Technische Machbarkeit wird geprüft', 5),
        (p_tenant_id,  3, 'Planung',               'Detailplanung des Projekts', 7),
        (p_tenant_id,  4, 'Bewilligung eingereicht','Baubewilligung wurde eingereicht', 14),
        (p_tenant_id,  5, 'Verzögerung',           'Projekt ist verzögert / blockiert', 7),
        (p_tenant_id,  6, 'Bewilligung erteilt',   'Baubewilligung wurde erteilt', 3),
        (p_tenant_id,  7, 'Material bestellt',     'Material wurde beim Lieferanten bestellt', 10),
        (p_tenant_id,  8, 'Material geliefert',    'Material ist eingetroffen', 3),
        (p_tenant_id,  9, 'Gerüst geplant',        'Gerüstaufbau terminiert', 5),
        (p_tenant_id, 10, 'Gerüst aufgebaut',      'Gerüst steht bereit', 3),
        (p_tenant_id, 11, 'DC-Montage',            'Gleichstrom-Installation (Module)', 5),
        (p_tenant_id, 12, 'AC-Montage',            'Wechselstrom-Installation (Wechselrichter)', 5),
        (p_tenant_id, 13, 'Zählermontage',         'Stromzähler wird installiert', 3),
        (p_tenant_id, 14, 'Inbetriebnahme',        'Anlage wird in Betrieb genommen', 3),
        (p_tenant_id, 15, 'Abnahme intern',        'Interne Qualitätskontrolle', 3),
        (p_tenant_id, 16, 'Abnahme Kunde',         'Kundenabnahme und Übergabe', 5),
        (p_tenant_id, 17, 'DC-Rechnung',           'DC-Teilrechnung erstellt', 7),
        (p_tenant_id, 18, 'Dokumentation',         'Projektdokumentation wird erstellt', 7),
        (p_tenant_id, 19, 'Meldung EVU',           'Meldung an Energieversorgungsunternehmen', 10),
        (p_tenant_id, 20, 'Meldung ESTI',          'Meldung an Eidg. Starkstrominspektorat', 10),
        (p_tenant_id, 21, 'Förderbeitrag',         'Förderbeitrag beantragt / eingegangen', 30),
        (p_tenant_id, 22, 'Steuerabzug',           'Steuerabzugsbescheinigung', 14),
        (p_tenant_id, 23, 'Schlussrechnung',       'Schlussrechnung erstellt und versendet', 14),
        (p_tenant_id, 24, 'Garantie aktiv',        'Projekt abgeschlossen, Garantiezeit läuft', 365),
        (p_tenant_id, 25, '1. Wartung',            'Erste planmässige Wartung', 30),
        (p_tenant_id, 26, '2. Wartung',            'Zweite planmässige Wartung', 30),
        (p_tenant_id, 27, 'Projekt abgeschlossen', 'Projekt vollständig abgeschlossen', NULL)
    ON CONFLICT (tenant_id, phase_number) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Update the seed_tenant_roles function to also seed phases
CREATE OR REPLACE FUNCTION seed_tenant_roles()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO roles (tenant_id, key, label, description, is_system) VALUES
        (NEW.id, 'super_user', 'Super User', 'Vollständiger Mandantenadministrator', true),
        (NEW.id, 'geschaeftsfuehrung', 'Geschäftsführung', 'Alle Module, alle Mitarbeiter, Coaching-Ansicht', true),
        (NEW.id, 'teamleiter', 'Teamleiter', 'Team-KPIs (Setter ODER Berater), keine Finanzen', true),
        (NEW.id, 'setter', 'Setter', 'Eigene Anrufe, eigene Termine, eigene KPIs', true),
        (NEW.id, 'berater', 'Berater', 'Eigene Pipeline, eigene Termine, eigene KPIs', true),
        (NEW.id, 'innendienst', 'Innendienst', 'Planung, Projektphasen, IA-Status', true),
        (NEW.id, 'bau', 'Bau / Montage', 'Zugewiesene Projekte, Installationstermine, Material', true),
        (NEW.id, 'buchhaltung', 'Buchhaltung', 'Rechnungen, Cashflow, Zahlungen', true),
        (NEW.id, 'leadkontrolle', 'Leadkontrolle', 'Alle Leads, Lead-Qualität', true)
    ON CONFLICT (tenant_id, key) DO NOTHING;

    -- Auto-assign default permissions to the newly created roles
    PERFORM assign_default_role_permissions(NEW.id);

    -- Seed 27 phase definitions for the new tenant
    PERFORM seed_tenant_phases(NEW.id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger (uses CREATE OR REPLACE above, trigger stays the same)
DROP TRIGGER IF EXISTS create_tenant_roles ON tenants;
CREATE TRIGGER create_tenant_roles
    AFTER INSERT ON tenants
    FOR EACH ROW EXECUTE FUNCTION seed_tenant_roles();

-- =============================================================================
-- 9. Enable RLS on All New Tables
-- =============================================================================

ALTER TABLE connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE connector_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_phase_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashflow_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashflow_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_scripts ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 10. Basic Tenant-Scoped RLS Policies
-- =============================================================================

-- ---- connectors ----
DROP POLICY IF EXISTS connectors_tenant_select ON connectors;
CREATE POLICY connectors_tenant_select ON connectors FOR SELECT USING (
    tenant_id = current_tenant_id() OR is_holding_admin()
);
DROP POLICY IF EXISTS connectors_tenant_insert ON connectors;
CREATE POLICY connectors_tenant_insert ON connectors FOR INSERT WITH CHECK (
    tenant_id = current_tenant_id()
);
DROP POLICY IF EXISTS connectors_tenant_update ON connectors;
CREATE POLICY connectors_tenant_update ON connectors FOR UPDATE USING (
    tenant_id = current_tenant_id()
);

-- ---- connector_sync_log ----
DROP POLICY IF EXISTS connector_sync_log_tenant_select ON connector_sync_log;
CREATE POLICY connector_sync_log_tenant_select ON connector_sync_log FOR SELECT USING (
    tenant_id = current_tenant_id() OR is_holding_admin()
);
DROP POLICY IF EXISTS connector_sync_log_tenant_insert ON connector_sync_log;
CREATE POLICY connector_sync_log_tenant_insert ON connector_sync_log FOR INSERT WITH CHECK (
    tenant_id = current_tenant_id()
);

-- ---- team_members ----
DROP POLICY IF EXISTS team_members_tenant_select ON team_members;
CREATE POLICY team_members_tenant_select ON team_members FOR SELECT USING (
    tenant_id = current_tenant_id() OR is_holding_admin()
);
DROP POLICY IF EXISTS team_members_tenant_insert ON team_members;
CREATE POLICY team_members_tenant_insert ON team_members FOR INSERT WITH CHECK (
    tenant_id = current_tenant_id()
);
DROP POLICY IF EXISTS team_members_tenant_update ON team_members;
CREATE POLICY team_members_tenant_update ON team_members FOR UPDATE USING (
    tenant_id = current_tenant_id()
);

-- ---- leads ----
DROP POLICY IF EXISTS leads_tenant_select ON leads;
CREATE POLICY leads_tenant_select ON leads FOR SELECT USING (
    tenant_id = current_tenant_id() OR is_holding_admin()
);
DROP POLICY IF EXISTS leads_tenant_insert ON leads;
CREATE POLICY leads_tenant_insert ON leads FOR INSERT WITH CHECK (
    tenant_id = current_tenant_id()
);
DROP POLICY IF EXISTS leads_tenant_update ON leads;
CREATE POLICY leads_tenant_update ON leads FOR UPDATE USING (
    tenant_id = current_tenant_id()
);

-- ---- offers ----
DROP POLICY IF EXISTS offers_tenant_select ON offers;
CREATE POLICY offers_tenant_select ON offers FOR SELECT USING (
    tenant_id = current_tenant_id() OR is_holding_admin()
);
DROP POLICY IF EXISTS offers_tenant_insert ON offers;
CREATE POLICY offers_tenant_insert ON offers FOR INSERT WITH CHECK (
    tenant_id = current_tenant_id()
);
DROP POLICY IF EXISTS offers_tenant_update ON offers;
CREATE POLICY offers_tenant_update ON offers FOR UPDATE USING (
    tenant_id = current_tenant_id()
);

-- ---- calls ----
DROP POLICY IF EXISTS calls_tenant_select ON calls;
CREATE POLICY calls_tenant_select ON calls FOR SELECT USING (
    tenant_id = current_tenant_id() OR is_holding_admin()
);
DROP POLICY IF EXISTS calls_tenant_insert ON calls;
CREATE POLICY calls_tenant_insert ON calls FOR INSERT WITH CHECK (
    tenant_id = current_tenant_id()
);

-- ---- call_analysis ----
DROP POLICY IF EXISTS call_analysis_tenant_select ON call_analysis;
CREATE POLICY call_analysis_tenant_select ON call_analysis FOR SELECT USING (
    tenant_id = current_tenant_id() OR is_holding_admin()
);
DROP POLICY IF EXISTS call_analysis_tenant_insert ON call_analysis;
CREATE POLICY call_analysis_tenant_insert ON call_analysis FOR INSERT WITH CHECK (
    tenant_id = current_tenant_id()
);

-- ---- invoices ----
DROP POLICY IF EXISTS invoices_tenant_select ON invoices;
CREATE POLICY invoices_tenant_select ON invoices FOR SELECT USING (
    tenant_id = current_tenant_id() OR is_holding_admin()
);
DROP POLICY IF EXISTS invoices_tenant_insert ON invoices;
CREATE POLICY invoices_tenant_insert ON invoices FOR INSERT WITH CHECK (
    tenant_id = current_tenant_id()
);
DROP POLICY IF EXISTS invoices_tenant_update ON invoices;
CREATE POLICY invoices_tenant_update ON invoices FOR UPDATE USING (
    tenant_id = current_tenant_id()
);

-- ---- phase_definitions ----
DROP POLICY IF EXISTS phase_definitions_tenant_select ON phase_definitions;
CREATE POLICY phase_definitions_tenant_select ON phase_definitions FOR SELECT USING (
    tenant_id = current_tenant_id() OR is_holding_admin()
);
DROP POLICY IF EXISTS phase_definitions_tenant_insert ON phase_definitions;
CREATE POLICY phase_definitions_tenant_insert ON phase_definitions FOR INSERT WITH CHECK (
    tenant_id = current_tenant_id()
);
DROP POLICY IF EXISTS phase_definitions_tenant_update ON phase_definitions;
CREATE POLICY phase_definitions_tenant_update ON phase_definitions FOR UPDATE USING (
    tenant_id = current_tenant_id()
);

-- ---- projects ----
DROP POLICY IF EXISTS projects_tenant_select ON projects;
CREATE POLICY projects_tenant_select ON projects FOR SELECT USING (
    tenant_id = current_tenant_id() OR is_holding_admin()
);
DROP POLICY IF EXISTS projects_tenant_insert ON projects;
CREATE POLICY projects_tenant_insert ON projects FOR INSERT WITH CHECK (
    tenant_id = current_tenant_id()
);
DROP POLICY IF EXISTS projects_tenant_update ON projects;
CREATE POLICY projects_tenant_update ON projects FOR UPDATE USING (
    tenant_id = current_tenant_id()
);

-- ---- project_phase_history ----
DROP POLICY IF EXISTS project_phase_history_tenant_select ON project_phase_history;
CREATE POLICY project_phase_history_tenant_select ON project_phase_history FOR SELECT USING (
    tenant_id = current_tenant_id() OR is_holding_admin()
);
DROP POLICY IF EXISTS project_phase_history_tenant_insert ON project_phase_history;
CREATE POLICY project_phase_history_tenant_insert ON project_phase_history FOR INSERT WITH CHECK (
    tenant_id = current_tenant_id()
);

-- ---- kpi_snapshots ----
DROP POLICY IF EXISTS kpi_snapshots_tenant_select ON kpi_snapshots;
CREATE POLICY kpi_snapshots_tenant_select ON kpi_snapshots FOR SELECT USING (
    tenant_id = current_tenant_id() OR is_holding_admin()
);
DROP POLICY IF EXISTS kpi_snapshots_tenant_insert ON kpi_snapshots;
CREATE POLICY kpi_snapshots_tenant_insert ON kpi_snapshots FOR INSERT WITH CHECK (
    tenant_id = current_tenant_id()
);

-- ---- cashflow_entries ----
DROP POLICY IF EXISTS cashflow_entries_tenant_select ON cashflow_entries;
CREATE POLICY cashflow_entries_tenant_select ON cashflow_entries FOR SELECT USING (
    tenant_id = current_tenant_id() OR is_holding_admin()
);
DROP POLICY IF EXISTS cashflow_entries_tenant_insert ON cashflow_entries;
CREATE POLICY cashflow_entries_tenant_insert ON cashflow_entries FOR INSERT WITH CHECK (
    tenant_id = current_tenant_id()
);

-- ---- calendar_events ----
DROP POLICY IF EXISTS calendar_events_tenant_select ON calendar_events;
CREATE POLICY calendar_events_tenant_select ON calendar_events FOR SELECT USING (
    tenant_id = current_tenant_id() OR is_holding_admin()
);
DROP POLICY IF EXISTS calendar_events_tenant_insert ON calendar_events;
CREATE POLICY calendar_events_tenant_insert ON calendar_events FOR INSERT WITH CHECK (
    tenant_id = current_tenant_id()
);

-- ---- payments ----
DROP POLICY IF EXISTS payments_tenant_select ON payments;
CREATE POLICY payments_tenant_select ON payments FOR SELECT USING (
    tenant_id = current_tenant_id() OR is_holding_admin()
);
DROP POLICY IF EXISTS payments_tenant_insert ON payments;
CREATE POLICY payments_tenant_insert ON payments FOR INSERT WITH CHECK (
    tenant_id = current_tenant_id()
);

-- ---- cashflow_uploads ----
DROP POLICY IF EXISTS cashflow_uploads_tenant_select ON cashflow_uploads;
CREATE POLICY cashflow_uploads_tenant_select ON cashflow_uploads FOR SELECT USING (
    tenant_id = current_tenant_id() OR is_holding_admin()
);
DROP POLICY IF EXISTS cashflow_uploads_tenant_insert ON cashflow_uploads;
CREATE POLICY cashflow_uploads_tenant_insert ON cashflow_uploads FOR INSERT WITH CHECK (
    tenant_id = current_tenant_id()
);

-- ---- offer_notes ----
DROP POLICY IF EXISTS offer_notes_tenant_select ON offer_notes;
CREATE POLICY offer_notes_tenant_select ON offer_notes FOR SELECT USING (
    tenant_id = current_tenant_id() OR is_holding_admin()
);
DROP POLICY IF EXISTS offer_notes_tenant_insert ON offer_notes;
CREATE POLICY offer_notes_tenant_insert ON offer_notes FOR INSERT WITH CHECK (
    tenant_id = current_tenant_id()
);
DROP POLICY IF EXISTS offer_notes_tenant_update ON offer_notes;
CREATE POLICY offer_notes_tenant_update ON offer_notes FOR UPDATE USING (
    tenant_id = current_tenant_id()
);

-- ---- call_scripts ----
DROP POLICY IF EXISTS call_scripts_tenant_select ON call_scripts;
CREATE POLICY call_scripts_tenant_select ON call_scripts FOR SELECT USING (
    tenant_id = current_tenant_id() OR is_holding_admin()
);
DROP POLICY IF EXISTS call_scripts_tenant_insert ON call_scripts;
CREATE POLICY call_scripts_tenant_insert ON call_scripts FOR INSERT WITH CHECK (
    tenant_id = current_tenant_id()
);
DROP POLICY IF EXISTS call_scripts_tenant_update ON call_scripts;
CREATE POLICY call_scripts_tenant_update ON call_scripts FOR UPDATE USING (
    tenant_id = current_tenant_id()
);

-- =============================================================================
-- End of Migration 002
-- =============================================================================
