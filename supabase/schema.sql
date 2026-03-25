-- =============================================================================
-- Enura Group Multi-Tenant BI Platform — Database Schema
-- PostgreSQL 15 + TimescaleDB
-- Region: EU (Frankfurt) / Switzerland
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE tenant_status AS ENUM ('active', 'suspended', 'archived');
CREATE TYPE lead_status AS ENUM ('new', 'contacted', 'qualified', 'appointment_set', 'won', 'lost', 'invalid');
CREATE TYPE lead_source AS ENUM ('website', 'referral', 'partner', 'advertising', 'cold_call', 'leadnotes', 'other');
CREATE TYPE offer_status AS ENUM ('draft', 'sent', 'negotiating', 'won', 'lost', 'expired');
CREATE TYPE call_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE call_status AS ENUM ('answered', 'missed', 'voicemail', 'busy', 'failed');
CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled', 'partially_paid');
CREATE TYPE project_status AS ENUM ('active', 'on_hold', 'completed', 'cancelled');
CREATE TYPE connector_type AS ENUM ('reonic', '3cx', 'bexio', 'google_calendar', 'leadnotes', 'whatsapp', 'gmail');
CREATE TYPE connector_status AS ENUM ('active', 'paused', 'error', 'disconnected');
CREATE TYPE sync_status AS ENUM ('running', 'success', 'error');
CREATE TYPE cashflow_type AS ENUM ('income', 'expense');

-- =============================================================================
-- CORE: Tenants
-- =============================================================================

CREATE TABLE tenants (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    status      tenant_status NOT NULL DEFAULT 'active',
    created_by  UUID REFERENCES auth.users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenants_slug ON tenants(slug);

-- =============================================================================
-- CORE: Tenant Branding
-- =============================================================================

CREATE TABLE tenant_brandings (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id         UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    primary_color     TEXT NOT NULL DEFAULT '#1A56DB',
    secondary_color   TEXT NOT NULL DEFAULT '#1A1A1A',
    accent_color      TEXT NOT NULL DEFAULT '#F3A917',
    background_color  TEXT NOT NULL DEFAULT '#FFFFFF',
    surface_color     TEXT NOT NULL DEFAULT '#F9FAFB',
    text_primary      TEXT NOT NULL DEFAULT '#111827',
    text_secondary    TEXT NOT NULL DEFAULT '#6B7280',
    font_family       TEXT NOT NULL DEFAULT 'Inter',
    font_url          TEXT,
    border_radius     TEXT NOT NULL DEFAULT '8px',
    logo_url          TEXT,
    dark_mode_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- CORE: Profiles (extends auth.users)
-- =============================================================================

CREATE TABLE profiles (
    id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id           UUID REFERENCES tenants(id) ON DELETE CASCADE,
    first_name          TEXT,
    last_name           TEXT,
    display_name        TEXT GENERATED ALWAYS AS (
        COALESCE(first_name || ' ' || last_name, first_name, last_name, 'Unknown')
    ) STORED,
    avatar_url          TEXT,
    phone               TEXT,
    locale              TEXT NOT NULL DEFAULT 'de-CH',
    must_reset_password BOOLEAN NOT NULL DEFAULT true,
    password_reset_at   TIMESTAMPTZ,
    totp_enabled        BOOLEAN NOT NULL DEFAULT false,
    totp_enrolled_at    TIMESTAMPTZ,
    last_sign_in_at     TIMESTAMPTZ,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_tenant ON profiles(tenant_id);

-- =============================================================================
-- CORE: Roles & Permissions
-- =============================================================================

CREATE TABLE roles (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
    key         TEXT NOT NULL,
    label       TEXT NOT NULL,
    description TEXT,
    is_system   BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, key)
);

CREATE TABLE permissions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key         TEXT NOT NULL UNIQUE,
    label       TEXT NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE role_permissions (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(role_id, permission_id)
);

CREATE TABLE profile_roles (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role_id    UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(profile_id, role_id)
);

CREATE INDEX idx_profile_roles_profile ON profile_roles(profile_id);
CREATE INDEX idx_profile_roles_role ON profile_roles(role_id);
CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);

-- =============================================================================
-- BUSINESS: Team Members
-- =============================================================================

CREATE TABLE team_members (
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

CREATE INDEX idx_team_members_tenant ON team_members(tenant_id);

-- =============================================================================
-- BUSINESS: Leads
-- =============================================================================

CREATE TABLE leads (
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

CREATE INDEX idx_leads_tenant ON leads(tenant_id);
CREATE INDEX idx_leads_status ON leads(tenant_id, status);
CREATE INDEX idx_leads_setter ON leads(setter_id);

-- =============================================================================
-- BUSINESS: Offers
-- =============================================================================

CREATE TABLE offers (
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

CREATE INDEX idx_offers_tenant ON offers(tenant_id);
CREATE INDEX idx_offers_lead ON offers(lead_id);
CREATE INDEX idx_offers_berater ON offers(berater_id);

-- =============================================================================
-- BUSINESS: Calls (TimescaleDB hypertable)
-- =============================================================================

CREATE TABLE calls (
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

SELECT create_hypertable('calls', 'started_at');
CREATE INDEX idx_calls_tenant ON calls(tenant_id, started_at DESC);
CREATE INDEX idx_calls_member ON calls(team_member_id, started_at DESC);

-- =============================================================================
-- BUSINESS: Call Analysis
-- =============================================================================

CREATE TABLE call_analysis (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    call_id             UUID NOT NULL,
    call_started_at     TIMESTAMPTZ NOT NULL,
    transcript          TEXT,
    greeting_score      SMALLINT CHECK (greeting_score BETWEEN 1 AND 10),
    needs_analysis_score SMALLINT CHECK (needs_analysis_score BETWEEN 1 AND 10),
    presentation_score  SMALLINT CHECK (presentation_score BETWEEN 1 AND 10),
    closing_score       SMALLINT CHECK (closing_score BETWEEN 1 AND 10),
    overall_score       SMALLINT CHECK (overall_score BETWEEN 1 AND 10),
    suggestions         JSONB,
    script_adherence    DECIMAL(5,2),
    model_version       TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
    analyzed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (call_id, call_started_at) REFERENCES calls(id, started_at) ON DELETE CASCADE
);

CREATE INDEX idx_call_analysis_tenant ON call_analysis(tenant_id);
CREATE INDEX idx_call_analysis_call ON call_analysis(call_id);

-- =============================================================================
-- BUSINESS: Invoices
-- =============================================================================

CREATE TABLE invoices (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    external_id       TEXT,
    offer_id          UUID REFERENCES offers(id),
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

CREATE INDEX idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX idx_invoices_status ON invoices(tenant_id, status);

-- =============================================================================
-- BUSINESS: Phase Definitions (27-phase Kanban)
-- =============================================================================

CREATE TABLE phase_definitions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    phase_number SMALLINT NOT NULL,
    name        TEXT NOT NULL,
    description TEXT,
    color       TEXT,
    stall_threshold_days INTEGER DEFAULT 7,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, phase_number)
);

-- =============================================================================
-- BUSINESS: Projects
-- =============================================================================

CREATE TABLE projects (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    external_id     TEXT,
    lead_id         UUID REFERENCES leads(id),
    offer_id        UUID REFERENCES offers(id),
    berater_id      UUID REFERENCES team_members(id),
    title           TEXT NOT NULL,
    customer_name   TEXT NOT NULL,
    address_street  TEXT,
    address_zip     TEXT,
    address_city    TEXT,
    phase_id        UUID REFERENCES phase_definitions(id),
    status          project_status NOT NULL DEFAULT 'active',
    phase_entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    installation_date DATE,
    completion_date   DATE,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_tenant ON projects(tenant_id);
CREATE INDEX idx_projects_phase ON projects(phase_id);
CREATE INDEX idx_projects_status ON projects(tenant_id, status);

-- =============================================================================
-- BUSINESS: Connectors
-- =============================================================================

CREATE TABLE connectors (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    type            connector_type NOT NULL,
    name            TEXT NOT NULL,
    credentials     JSONB NOT NULL DEFAULT '{}',
    config          JSONB NOT NULL DEFAULT '{}',
    status          connector_status NOT NULL DEFAULT 'disconnected',
    last_synced_at  TIMESTAMPTZ,
    last_error      TEXT,
    sync_interval_minutes INTEGER NOT NULL DEFAULT 15,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, type)
);

-- =============================================================================
-- BUSINESS: Connector Sync Log
-- =============================================================================

CREATE TABLE connector_sync_log (
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

CREATE INDEX idx_sync_log_connector ON connector_sync_log(connector_id, started_at DESC);

-- =============================================================================
-- ANALYTICS: KPI Snapshots (TimescaleDB hypertable)
-- =============================================================================

CREATE TABLE kpi_snapshots (
    id              UUID NOT NULL DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    snapshot_type   TEXT NOT NULL,
    entity_id       UUID,
    period_date     DATE NOT NULL,
    metrics         JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, period_date)
);

SELECT create_hypertable('kpi_snapshots', 'period_date');
CREATE INDEX idx_kpi_snapshots_lookup ON kpi_snapshots(tenant_id, snapshot_type, entity_id, period_date DESC);

-- =============================================================================
-- ANALYTICS: Cashflow Entries (TimescaleDB hypertable)
-- =============================================================================

CREATE TABLE cashflow_entries (
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

SELECT create_hypertable('cashflow_entries', 'entry_date');
CREATE INDEX idx_cashflow_tenant ON cashflow_entries(tenant_id, entry_date DESC);

-- =============================================================================
-- ANALYTICS: Calendar Events (TimescaleDB hypertable)
-- =============================================================================

CREATE TABLE calendar_events (
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

SELECT create_hypertable('calendar_events', 'starts_at');
CREATE INDEX idx_calendar_tenant ON calendar_events(tenant_id, starts_at DESC);
CREATE INDEX idx_calendar_member ON calendar_events(team_member_id, starts_at DESC);

-- =============================================================================
-- SYSTEM: Audit Log (TimescaleDB hypertable)
-- =============================================================================

CREATE TABLE audit_log (
    id              UUID NOT NULL DEFAULT uuid_generate_v4(),
    tenant_id       UUID REFERENCES tenants(id),
    actor_id        UUID REFERENCES profiles(id),
    action          TEXT NOT NULL,
    entity_type     TEXT NOT NULL,
    entity_id       UUID,
    details         JSONB,
    ip_address      INET,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
);

SELECT create_hypertable('audit_log', 'created_at');
CREATE INDEX idx_audit_tenant ON audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_audit_actor ON audit_log(actor_id, created_at DESC);

-- =============================================================================
-- RLS Helper Functions
-- =============================================================================

CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT tenant_id FROM profiles
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_holding_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        SELECT EXISTS (
            SELECT 1 FROM profile_roles pr
            JOIN roles r ON r.id = pr.role_id
            WHERE pr.profile_id = auth.uid()
            AND r.key = 'holding_admin'
            AND r.tenant_id IS NULL
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION has_permission(perm_key TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        SELECT EXISTS (
            SELECT 1 FROM profile_roles pr
            JOIN role_permissions rp ON rp.role_id = pr.role_id
            JOIN permissions p ON p.id = rp.permission_id
            WHERE pr.profile_id = auth.uid()
            AND p.key = perm_key
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================================================
-- RLS Policies
-- =============================================================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_brandings ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE connector_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashflow_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Tenants: holding admins see all, tenant users see own
CREATE POLICY tenants_select ON tenants FOR SELECT USING (
    is_holding_admin() OR id = current_tenant_id()
);

-- Tenant brandings: same as tenants
CREATE POLICY brandings_select ON tenant_brandings FOR SELECT USING (
    is_holding_admin() OR tenant_id = current_tenant_id()
);
CREATE POLICY brandings_update ON tenant_brandings FOR UPDATE USING (
    is_holding_admin() OR (tenant_id = current_tenant_id() AND has_permission('module:admin:branding'))
);

-- Profiles: tenant users see own tenant, holding sees all
CREATE POLICY profiles_select ON profiles FOR SELECT USING (
    is_holding_admin() OR tenant_id = current_tenant_id() OR id = auth.uid()
);

-- Tenant-scoped data: standard pattern
CREATE POLICY leads_select ON leads FOR SELECT USING (
    is_holding_admin() OR tenant_id = current_tenant_id()
);
CREATE POLICY leads_insert ON leads FOR INSERT WITH CHECK (
    tenant_id = current_tenant_id()
);
CREATE POLICY leads_update ON leads FOR UPDATE USING (
    tenant_id = current_tenant_id()
);

CREATE POLICY offers_select ON offers FOR SELECT USING (
    is_holding_admin() OR tenant_id = current_tenant_id()
);
CREATE POLICY offers_insert ON offers FOR INSERT WITH CHECK (
    tenant_id = current_tenant_id()
);
CREATE POLICY offers_update ON offers FOR UPDATE USING (
    tenant_id = current_tenant_id()
);

CREATE POLICY calls_select ON calls FOR SELECT USING (
    is_holding_admin() OR tenant_id = current_tenant_id()
);

CREATE POLICY call_analysis_select ON call_analysis FOR SELECT USING (
    is_holding_admin() OR tenant_id = current_tenant_id()
);

CREATE POLICY invoices_select ON invoices FOR SELECT USING (
    is_holding_admin() OR tenant_id = current_tenant_id()
);
CREATE POLICY invoices_insert ON invoices FOR INSERT WITH CHECK (
    tenant_id = current_tenant_id()
);

CREATE POLICY projects_select ON projects FOR SELECT USING (
    is_holding_admin() OR tenant_id = current_tenant_id()
);
CREATE POLICY projects_insert ON projects FOR INSERT WITH CHECK (
    tenant_id = current_tenant_id()
);
CREATE POLICY projects_update ON projects FOR UPDATE USING (
    tenant_id = current_tenant_id()
);

CREATE POLICY team_members_select ON team_members FOR SELECT USING (
    is_holding_admin() OR tenant_id = current_tenant_id()
);

CREATE POLICY phase_definitions_select ON phase_definitions FOR SELECT USING (
    is_holding_admin() OR tenant_id = current_tenant_id()
);

CREATE POLICY connectors_select ON connectors FOR SELECT USING (
    is_holding_admin() OR (tenant_id = current_tenant_id() AND has_permission('module:admin:read'))
);

CREATE POLICY kpi_snapshots_select ON kpi_snapshots FOR SELECT USING (
    is_holding_admin() OR tenant_id = current_tenant_id()
);

CREATE POLICY cashflow_entries_select ON cashflow_entries FOR SELECT USING (
    is_holding_admin() OR tenant_id = current_tenant_id()
);

CREATE POLICY calendar_events_select ON calendar_events FOR SELECT USING (
    is_holding_admin() OR tenant_id = current_tenant_id()
);

CREATE POLICY audit_log_select ON audit_log FOR SELECT USING (
    is_holding_admin() OR tenant_id = current_tenant_id()
);

CREATE POLICY roles_select ON roles FOR SELECT USING (
    is_holding_admin() OR tenant_id = current_tenant_id()
);

CREATE POLICY permissions_select ON permissions FOR SELECT USING (true);

CREATE POLICY role_permissions_select ON role_permissions FOR SELECT USING (true);

CREATE POLICY profile_roles_select ON profile_roles FOR SELECT USING (
    is_holding_admin() OR profile_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM profiles p WHERE p.id = profile_roles.profile_id
        AND p.tenant_id = current_tenant_id()
    )
);

CREATE POLICY connector_sync_log_select ON connector_sync_log FOR SELECT USING (
    is_holding_admin() OR tenant_id = current_tenant_id()
);

-- =============================================================================
-- Updated_at Triggers
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON tenant_brandings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON team_members FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON offers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON connectors FOR EACH ROW EXECUTE FUNCTION update_updated_at();
