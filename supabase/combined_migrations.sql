-- ====== 001_auth_and_identity.sql ======
-- =============================================================================
-- Migration 001: Auth & Identity (Phase 2)
-- Enura Group Multi-Tenant BI Platform
--
-- Contains: tenants, branding, profiles, roles, permissions, holding_admins,
--           audit_log, RLS policies, helper functions, seed data.
-- Idempotent: safe to run multiple times.
-- =============================================================================

-- =============================================================================
-- 1. Extensions
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =============================================================================
-- 2. Enums
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE tenant_status AS ENUM ('active', 'suspended', 'archived');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- 3. Tables
-- =============================================================================

-- Tenants
CREATE TABLE IF NOT EXISTS tenants (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    status      tenant_status NOT NULL DEFAULT 'active',
    created_by  UUID REFERENCES auth.users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);

-- Tenant Brandings
CREATE TABLE IF NOT EXISTS tenant_brandings (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
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

CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON profiles(tenant_id);

-- Roles
CREATE TABLE IF NOT EXISTS roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
    key         TEXT NOT NULL,
    label       TEXT NOT NULL,
    description TEXT,
    is_system   BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, key)
);

-- Permissions
CREATE TABLE IF NOT EXISTS permissions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key         TEXT NOT NULL UNIQUE,
    label       TEXT NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Role Permissions
CREATE TABLE IF NOT EXISTS role_permissions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(role_id, permission_id)
);

-- Profile Roles
CREATE TABLE IF NOT EXISTS profile_roles (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role_id    UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(profile_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_roles_profile ON profile_roles(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_roles_role ON profile_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);

-- Holding Admins
CREATE TABLE IF NOT EXISTS holding_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit Log (simplified â€” regular table, NOT a hypertable for Phase 2)
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    actor_id UUID REFERENCES profiles(id),
    action TEXT NOT NULL,
    table_name TEXT,
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_id, created_at DESC);

-- =============================================================================
-- 4. Updated_at Trigger Function
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create updated_at triggers (DROP first for idempotency)
DROP TRIGGER IF EXISTS set_updated_at ON tenants;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON tenant_brandings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON tenant_brandings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON profiles;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON roles;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- 5. RLS Helper Functions
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
            SELECT 1 FROM holding_admins
            WHERE profile_id = auth.uid()
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
-- 6. Enable RLS on All Tables
-- =============================================================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_brandings ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE holding_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 7. RLS Policies
-- =============================================================================

-- ---- tenants ----

-- SELECT: holding admins see all, tenant users see own
DROP POLICY IF EXISTS tenants_select ON tenants;
CREATE POLICY tenants_select ON tenants FOR SELECT USING (
    is_holding_admin() OR id = current_tenant_id()
);

-- INSERT: holding admins only
DROP POLICY IF EXISTS tenants_insert ON tenants;
CREATE POLICY tenants_insert ON tenants FOR INSERT WITH CHECK (
    is_holding_admin()
);

-- UPDATE: holding admins only
DROP POLICY IF EXISTS tenants_update ON tenants;
CREATE POLICY tenants_update ON tenants FOR UPDATE USING (
    is_holding_admin()
);

-- ---- tenant_brandings ----

-- SELECT: holding admins or own tenant
DROP POLICY IF EXISTS brandings_select ON tenant_brandings;
CREATE POLICY brandings_select ON tenant_brandings FOR SELECT USING (
    is_holding_admin() OR tenant_id = current_tenant_id()
);

-- INSERT: holding admins only
DROP POLICY IF EXISTS brandings_insert ON tenant_brandings;
CREATE POLICY brandings_insert ON tenant_brandings FOR INSERT WITH CHECK (
    is_holding_admin()
);

-- UPDATE: holding admin or own tenant with branding permission
DROP POLICY IF EXISTS brandings_update ON tenant_brandings;
CREATE POLICY brandings_update ON tenant_brandings FOR UPDATE USING (
    is_holding_admin() OR (tenant_id = current_tenant_id() AND has_permission('module:admin:branding'))
);

-- ---- profiles ----

-- SELECT: holding admin sees all, tenant users see own tenant, everyone sees self
DROP POLICY IF EXISTS profiles_select ON profiles;
CREATE POLICY profiles_select ON profiles FOR SELECT USING (
    is_holding_admin() OR tenant_id = current_tenant_id() OR id = auth.uid()
);

-- INSERT: for creating new users (holding admin or same-tenant super user)
DROP POLICY IF EXISTS profiles_insert ON profiles;
CREATE POLICY profiles_insert ON profiles FOR INSERT WITH CHECK (
    is_holding_admin()
    OR has_permission('module:admin:users')
    OR id = auth.uid()
);

-- UPDATE: own profile, holding admin, or same-tenant super user
DROP POLICY IF EXISTS profiles_update ON profiles;
CREATE POLICY profiles_update ON profiles FOR UPDATE USING (
    id = auth.uid()
    OR is_holding_admin()
    OR (tenant_id = current_tenant_id() AND has_permission('module:admin:users'))
);

-- ---- roles ----

-- SELECT: holding admin or own tenant
DROP POLICY IF EXISTS roles_select ON roles;
CREATE POLICY roles_select ON roles FOR SELECT USING (
    is_holding_admin() OR tenant_id = current_tenant_id()
);

-- INSERT: holding admins only
DROP POLICY IF EXISTS roles_insert ON roles;
CREATE POLICY roles_insert ON roles FOR INSERT WITH CHECK (
    is_holding_admin()
);

-- ---- permissions ----

-- SELECT: all authenticated users can read permissions
DROP POLICY IF EXISTS permissions_select ON permissions;
CREATE POLICY permissions_select ON permissions FOR SELECT USING (true);

-- ---- role_permissions ----

-- SELECT: all authenticated users can read role-permission mappings
DROP POLICY IF EXISTS role_permissions_select ON role_permissions;
CREATE POLICY role_permissions_select ON role_permissions FOR SELECT USING (true);

-- ---- profile_roles ----

-- SELECT: holding admin, self, or same-tenant users
DROP POLICY IF EXISTS profile_roles_select ON profile_roles;
CREATE POLICY profile_roles_select ON profile_roles FOR SELECT USING (
    is_holding_admin() OR profile_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM profiles p WHERE p.id = profile_roles.profile_id
        AND p.tenant_id = current_tenant_id()
    )
);

-- INSERT: holding admin or same-tenant super user
DROP POLICY IF EXISTS profile_roles_insert ON profile_roles;
CREATE POLICY profile_roles_insert ON profile_roles FOR INSERT WITH CHECK (
    is_holding_admin()
    OR (
        has_permission('module:admin:users')
        AND EXISTS (
            SELECT 1 FROM profiles p WHERE p.id = profile_roles.profile_id
            AND p.tenant_id = current_tenant_id()
        )
    )
);

-- DELETE: holding admin or same-tenant super user
DROP POLICY IF EXISTS profile_roles_delete ON profile_roles;
CREATE POLICY profile_roles_delete ON profile_roles FOR DELETE USING (
    is_holding_admin()
    OR (
        has_permission('module:admin:users')
        AND EXISTS (
            SELECT 1 FROM profiles p WHERE p.id = profile_roles.profile_id
            AND p.tenant_id = current_tenant_id()
        )
    )
);

-- ---- holding_admins ----

-- SELECT: holding admins see all, users see own row
DROP POLICY IF EXISTS holding_admins_select ON holding_admins;
CREATE POLICY holding_admins_select ON holding_admins FOR SELECT USING (
    is_holding_admin() OR profile_id = auth.uid()
);

-- ---- audit_log ----

-- INSERT: any authenticated user
DROP POLICY IF EXISTS audit_log_insert ON audit_log;
CREATE POLICY audit_log_insert ON audit_log FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
);

-- SELECT: holding admin or own tenant
DROP POLICY IF EXISTS audit_log_select ON audit_log;
CREATE POLICY audit_log_select ON audit_log FOR SELECT USING (
    is_holding_admin() OR tenant_id = current_tenant_id()
);

-- =============================================================================
-- 8. Init Tenant Branding Trigger
-- =============================================================================

CREATE OR REPLACE FUNCTION init_tenant_branding()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO tenant_brandings (tenant_id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS create_tenant_branding ON tenants;
CREATE TRIGGER create_tenant_branding
    AFTER INSERT ON tenants
    FOR EACH ROW EXECUTE FUNCTION init_tenant_branding();

-- =============================================================================
-- 9. Assign Default Role Permissions Function
-- =============================================================================

CREATE OR REPLACE FUNCTION assign_default_role_permissions(p_tenant_id UUID)
RETURNS VOID AS $$
DECLARE
    v_role_id UUID;
    v_perm_id UUID;
    v_role RECORD;
BEGIN
    -- super_user: ALL module:* permissions
    SELECT id INTO v_role_id FROM roles WHERE tenant_id = p_tenant_id AND key = 'super_user';
    IF v_role_id IS NOT NULL THEN
        FOR v_perm_id IN SELECT id FROM permissions WHERE key LIKE 'module:%'
        LOOP
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES (v_role_id, v_perm_id)
            ON CONFLICT (role_id, permission_id) DO NOTHING;
        END LOOP;
    END IF;

    -- geschaeftsfuehrung: ALL module:*:read permissions
    SELECT id INTO v_role_id FROM roles WHERE tenant_id = p_tenant_id AND key = 'geschaeftsfuehrung';
    IF v_role_id IS NOT NULL THEN
        FOR v_perm_id IN SELECT id FROM permissions WHERE key LIKE 'module:%:read'
        LOOP
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES (v_role_id, v_perm_id)
            ON CONFLICT (role_id, permission_id) DO NOTHING;
        END LOOP;
    END IF;

    -- teamleiter: module:setter:read, module:berater:read, module:leads:read
    SELECT id INTO v_role_id FROM roles WHERE tenant_id = p_tenant_id AND key = 'teamleiter';
    IF v_role_id IS NOT NULL THEN
        FOR v_perm_id IN SELECT id FROM permissions WHERE key IN ('module:setter:read', 'module:berater:read', 'module:leads:read')
        LOOP
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES (v_role_id, v_perm_id)
            ON CONFLICT (role_id, permission_id) DO NOTHING;
        END LOOP;
    END IF;

    -- setter: module:setter:read
    SELECT id INTO v_role_id FROM roles WHERE tenant_id = p_tenant_id AND key = 'setter';
    IF v_role_id IS NOT NULL THEN
        SELECT id INTO v_perm_id FROM permissions WHERE key = 'module:setter:read';
        IF v_perm_id IS NOT NULL THEN
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES (v_role_id, v_perm_id)
            ON CONFLICT (role_id, permission_id) DO NOTHING;
        END IF;
    END IF;

    -- berater: module:berater:read
    SELECT id INTO v_role_id FROM roles WHERE tenant_id = p_tenant_id AND key = 'berater';
    IF v_role_id IS NOT NULL THEN
        SELECT id INTO v_perm_id FROM permissions WHERE key = 'module:berater:read';
        IF v_perm_id IS NOT NULL THEN
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES (v_role_id, v_perm_id)
            ON CONFLICT (role_id, permission_id) DO NOTHING;
        END IF;
    END IF;

    -- innendienst: module:innendienst:read, module:innendienst:write
    SELECT id INTO v_role_id FROM roles WHERE tenant_id = p_tenant_id AND key = 'innendienst';
    IF v_role_id IS NOT NULL THEN
        FOR v_perm_id IN SELECT id FROM permissions WHERE key IN ('module:innendienst:read', 'module:innendienst:write')
        LOOP
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES (v_role_id, v_perm_id)
            ON CONFLICT (role_id, permission_id) DO NOTHING;
        END LOOP;
    END IF;

    -- bau: module:bau:read, module:bau:write
    SELECT id INTO v_role_id FROM roles WHERE tenant_id = p_tenant_id AND key = 'bau';
    IF v_role_id IS NOT NULL THEN
        FOR v_perm_id IN SELECT id FROM permissions WHERE key IN ('module:bau:read', 'module:bau:write')
        LOOP
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES (v_role_id, v_perm_id)
            ON CONFLICT (role_id, permission_id) DO NOTHING;
        END LOOP;
    END IF;

    -- buchhaltung: module:finance:read, module:finance:write
    SELECT id INTO v_role_id FROM roles WHERE tenant_id = p_tenant_id AND key = 'buchhaltung';
    IF v_role_id IS NOT NULL THEN
        FOR v_perm_id IN SELECT id FROM permissions WHERE key IN ('module:finance:read', 'module:finance:write')
        LOOP
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES (v_role_id, v_perm_id)
            ON CONFLICT (role_id, permission_id) DO NOTHING;
        END LOOP;
    END IF;

    -- leadkontrolle: module:leads:read, module:leads:write
    SELECT id INTO v_role_id FROM roles WHERE tenant_id = p_tenant_id AND key = 'leadkontrolle';
    IF v_role_id IS NOT NULL THEN
        FOR v_perm_id IN SELECT id FROM permissions WHERE key IN ('module:leads:read', 'module:leads:write')
        LOOP
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES (v_role_id, v_perm_id)
            ON CONFLICT (role_id, permission_id) DO NOTHING;
        END LOOP;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 10. Seed Tenant Roles Trigger (calls assign_default_role_permissions)
-- =============================================================================

CREATE OR REPLACE FUNCTION seed_tenant_roles()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO roles (tenant_id, key, label, description, is_system) VALUES
        (NEW.id, 'super_user', 'Super User', 'VollstÃ¤ndiger Mandantenadministrator', true),
        (NEW.id, 'geschaeftsfuehrung', 'GeschÃ¤ftsfÃ¼hrung', 'Alle Module, alle Mitarbeiter, Coaching-Ansicht', true),
        (NEW.id, 'teamleiter', 'Teamleiter', 'Team-KPIs (Setter ODER Berater), keine Finanzen', true),
        (NEW.id, 'setter', 'Setter', 'Eigene Anrufe, eigene Termine, eigene KPIs', true),
        (NEW.id, 'berater', 'Berater', 'Eigene Pipeline, eigene Termine, eigene KPIs', true),
        (NEW.id, 'innendienst', 'Innendienst', 'Planung, Projektphasen, IA-Status', true),
        (NEW.id, 'bau', 'Bau / Montage', 'Zugewiesene Projekte, Installationstermine, Material', true),
        (NEW.id, 'buchhaltung', 'Buchhaltung', 'Rechnungen, Cashflow, Zahlungen', true),
        (NEW.id, 'leadkontrolle', 'Leadkontrolle', 'Alle Leads, Lead-QualitÃ¤t', true);

    -- Auto-assign default permissions to the newly created roles
    PERFORM assign_default_role_permissions(NEW.id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS create_tenant_roles ON tenants;
CREATE TRIGGER create_tenant_roles
    AFTER INSERT ON tenants
    FOR EACH ROW EXECUTE FUNCTION seed_tenant_roles();

-- =============================================================================
-- 11. Seed Permissions
-- =============================================================================

INSERT INTO permissions (key, label, description) VALUES
    ('module:setter:read', 'Setter lesen', 'Setter-Performance-Modul anzeigen'),
    ('module:setter:write', 'Setter schreiben', 'Setter-Daten bearbeiten'),
    ('module:berater:read', 'Berater lesen', 'Berater-Performance-Modul anzeigen'),
    ('module:berater:write', 'Berater schreiben', 'Berater-Daten bearbeiten'),
    ('module:leads:read', 'Leads lesen', 'Leadkontrolle-Modul anzeigen'),
    ('module:leads:write', 'Leads schreiben', 'Lead-Daten bearbeiten'),
    ('module:innendienst:read', 'Innendienst lesen', 'Innendienst-Modul anzeigen'),
    ('module:innendienst:write', 'Innendienst schreiben', 'Innendienst-Daten bearbeiten'),
    ('module:bau:read', 'Bau lesen', 'Bau & Montage-Modul anzeigen'),
    ('module:bau:write', 'Bau schreiben', 'Bau-Daten bearbeiten'),
    ('module:finance:read', 'Finanzen lesen', 'Finanz-Modul anzeigen'),
    ('module:finance:write', 'Finanzen schreiben', 'Finanzdaten bearbeiten'),
    ('module:reports:read', 'Berichte lesen', 'Berichte anzeigen'),
    ('module:reports:write', 'Berichte schreiben', 'Berichte erstellen/bearbeiten'),
    ('module:ai:read', 'KI lesen', 'KI-Analysen anzeigen'),
    ('module:ai:write', 'KI schreiben', 'KI-Einstellungen bearbeiten'),
    ('module:admin:read', 'Admin lesen', 'Einstellungen anzeigen'),
    ('module:admin:write', 'Admin schreiben', 'Einstellungen bearbeiten'),
    ('module:admin:users', 'Benutzer verwalten', 'Benutzer erstellen und bearbeiten'),
    ('module:admin:branding', 'Branding verwalten', 'Markeneinstellungen bearbeiten'),
    ('holding:global', 'Holding-Zugriff', 'VollstÃ¤ndiger Holding-Administrator-Zugriff')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- End of Migration 001
-- =============================================================================


-- ====== 002_business_data.sql ======
-- =============================================================================
-- Migration 002: Business Data Tables (Phase 3)
-- Enura Group Multi-Tenant BI Platform
--
-- Contains: All remaining business tables not in 001 â€” connectors, team_members,
--           leads, offers, calls, call_analysis, invoices, projects, phases,
--           KPI snapshots, cashflow, calendar events, payments, offer_notes,
--           call_scripts, cashflow_uploads, project_phase_history.
-- Idempotent: safe to run multiple times.
-- =============================================================================

-- =============================================================================
-- 1. TimescaleDB Extension (optional â€” falls back gracefully)
-- =============================================================================

DO $$ BEGIN
    CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'TimescaleDB extension not available â€” will use BRIN indexes as fallback.';
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
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id              UUID NOT NULL DEFAULT gen_random_uuid(),
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
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id              UUID NOT NULL DEFAULT gen_random_uuid(),
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
    id              UUID NOT NULL DEFAULT gen_random_uuid(),
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
    id              UUID NOT NULL DEFAULT gen_random_uuid(),
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
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    offer_id        UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
    author_id       UUID REFERENCES profiles(id),
    content         TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Call Scripts ----
CREATE TABLE IF NOT EXISTS call_scripts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- calls â†’ hypertable on started_at
DO $$ BEGIN
    PERFORM create_hypertable('calls', 'started_at', if_not_exists => TRUE);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'TimescaleDB not available for calls, using BRIN index instead.';
    CREATE INDEX IF NOT EXISTS idx_calls_started_at_brin ON calls USING BRIN (started_at);
END $$;

-- kpi_snapshots â†’ hypertable on period_date
DO $$ BEGIN
    PERFORM create_hypertable('kpi_snapshots', 'period_date', if_not_exists => TRUE);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'TimescaleDB not available for kpi_snapshots, using BRIN index instead.';
    CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_period_date_brin ON kpi_snapshots USING BRIN (period_date);
END $$;

-- cashflow_entries â†’ hypertable on entry_date
DO $$ BEGIN
    PERFORM create_hypertable('cashflow_entries', 'entry_date', if_not_exists => TRUE);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'TimescaleDB not available for cashflow_entries, using BRIN index instead.';
    CREATE INDEX IF NOT EXISTS idx_cashflow_entries_entry_date_brin ON cashflow_entries USING BRIN (entry_date);
END $$;

-- calendar_events â†’ hypertable on starts_at
DO $$ BEGIN
    PERFORM create_hypertable('calendar_events', 'starts_at', if_not_exists => TRUE);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'TimescaleDB not available for calendar_events, using BRIN index instead.';
    CREATE INDEX IF NOT EXISTS idx_calendar_events_starts_at_brin ON calendar_events USING BRIN (starts_at);
END $$;

-- audit_log â†’ convert existing table to hypertable (already exists from 001)
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
-- 6. Triggers â€” updated_at
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
        (p_tenant_id,  2, 'Technische PrÃ¼fung',    'Technische Machbarkeit wird geprÃ¼ft', 5),
        (p_tenant_id,  3, 'Planung',               'Detailplanung des Projekts', 7),
        (p_tenant_id,  4, 'Bewilligung eingereicht','Baubewilligung wurde eingereicht', 14),
        (p_tenant_id,  5, 'VerzÃ¶gerung',           'Projekt ist verzÃ¶gert / blockiert', 7),
        (p_tenant_id,  6, 'Bewilligung erteilt',   'Baubewilligung wurde erteilt', 3),
        (p_tenant_id,  7, 'Material bestellt',     'Material wurde beim Lieferanten bestellt', 10),
        (p_tenant_id,  8, 'Material geliefert',    'Material ist eingetroffen', 3),
        (p_tenant_id,  9, 'GerÃ¼st geplant',        'GerÃ¼staufbau terminiert', 5),
        (p_tenant_id, 10, 'GerÃ¼st aufgebaut',      'GerÃ¼st steht bereit', 3),
        (p_tenant_id, 11, 'DC-Montage',            'Gleichstrom-Installation (Module)', 5),
        (p_tenant_id, 12, 'AC-Montage',            'Wechselstrom-Installation (Wechselrichter)', 5),
        (p_tenant_id, 13, 'ZÃ¤hlermontage',         'StromzÃ¤hler wird installiert', 3),
        (p_tenant_id, 14, 'Inbetriebnahme',        'Anlage wird in Betrieb genommen', 3),
        (p_tenant_id, 15, 'Abnahme intern',        'Interne QualitÃ¤tskontrolle', 3),
        (p_tenant_id, 16, 'Abnahme Kunde',         'Kundenabnahme und Ãœbergabe', 5),
        (p_tenant_id, 17, 'DC-Rechnung',           'DC-Teilrechnung erstellt', 7),
        (p_tenant_id, 18, 'Dokumentation',         'Projektdokumentation wird erstellt', 7),
        (p_tenant_id, 19, 'Meldung EVU',           'Meldung an Energieversorgungsunternehmen', 10),
        (p_tenant_id, 20, 'Meldung ESTI',          'Meldung an Eidg. Starkstrominspektorat', 10),
        (p_tenant_id, 21, 'FÃ¶rderbeitrag',         'FÃ¶rderbeitrag beantragt / eingegangen', 30),
        (p_tenant_id, 22, 'Steuerabzug',           'Steuerabzugsbescheinigung', 14),
        (p_tenant_id, 23, 'Schlussrechnung',       'Schlussrechnung erstellt und versendet', 14),
        (p_tenant_id, 24, 'Garantie aktiv',        'Projekt abgeschlossen, Garantiezeit lÃ¤uft', 365),
        (p_tenant_id, 25, '1. Wartung',            'Erste planmÃ¤ssige Wartung', 30),
        (p_tenant_id, 26, '2. Wartung',            'Zweite planmÃ¤ssige Wartung', 30),
        (p_tenant_id, 27, 'Projekt abgeschlossen', 'Projekt vollstÃ¤ndig abgeschlossen', NULL)
    ON CONFLICT (tenant_id, phase_number) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Update the seed_tenant_roles function to also seed phases
CREATE OR REPLACE FUNCTION seed_tenant_roles()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO roles (tenant_id, key, label, description, is_system) VALUES
        (NEW.id, 'super_user', 'Super User', 'VollstÃ¤ndiger Mandantenadministrator', true),
        (NEW.id, 'geschaeftsfuehrung', 'GeschÃ¤ftsfÃ¼hrung', 'Alle Module, alle Mitarbeiter, Coaching-Ansicht', true),
        (NEW.id, 'teamleiter', 'Teamleiter', 'Team-KPIs (Setter ODER Berater), keine Finanzen', true),
        (NEW.id, 'setter', 'Setter', 'Eigene Anrufe, eigene Termine, eigene KPIs', true),
        (NEW.id, 'berater', 'Berater', 'Eigene Pipeline, eigene Termine, eigene KPIs', true),
        (NEW.id, 'innendienst', 'Innendienst', 'Planung, Projektphasen, IA-Status', true),
        (NEW.id, 'bau', 'Bau / Montage', 'Zugewiesene Projekte, Installationstermine, Material', true),
        (NEW.id, 'buchhaltung', 'Buchhaltung', 'Rechnungen, Cashflow, Zahlungen', true),
        (NEW.id, 'leadkontrolle', 'Leadkontrolle', 'Alle Leads, Lead-QualitÃ¤t', true)
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


-- ====== 003_business_rls.sql ======
-- =============================================================================
-- Migration 003: Fine-Grained Business RLS Policies
-- Enura Group Multi-Tenant BI Platform
--
-- Contains: Holding admin full-override policies for all business tables,
--           permission-gated finance policies, AI/call analysis permission gates.
-- Idempotent: safe to run multiple times.
-- =============================================================================

-- =============================================================================
-- 1. Drop Any Conflicting Policies From Previous Migrations
--    (schema.sql had basic policies that may conflict with the new ones)
-- =============================================================================

-- Drop old schema.sql-style policies that might exist on these tables
-- (from schema.sql direct application, NOT from 001 or 002)
DROP POLICY IF EXISTS leads_select ON leads;
DROP POLICY IF EXISTS leads_insert ON leads;
DROP POLICY IF EXISTS leads_update ON leads;
DROP POLICY IF EXISTS offers_select ON offers;
DROP POLICY IF EXISTS offers_insert ON offers;
DROP POLICY IF EXISTS offers_update ON offers;
DROP POLICY IF EXISTS calls_select ON calls;
DROP POLICY IF EXISTS call_analysis_select ON call_analysis;
DROP POLICY IF EXISTS invoices_select ON invoices;
DROP POLICY IF EXISTS invoices_insert ON invoices;
DROP POLICY IF EXISTS projects_select ON projects;
DROP POLICY IF EXISTS projects_insert ON projects;
DROP POLICY IF EXISTS projects_update ON projects;
DROP POLICY IF EXISTS team_members_select ON team_members;
DROP POLICY IF EXISTS phase_definitions_select ON phase_definitions;
DROP POLICY IF EXISTS connectors_select ON connectors;
DROP POLICY IF EXISTS kpi_snapshots_select ON kpi_snapshots;
DROP POLICY IF EXISTS cashflow_entries_select ON cashflow_entries;
DROP POLICY IF EXISTS calendar_events_select ON calendar_events;
DROP POLICY IF EXISTS connector_sync_log_select ON connector_sync_log;

-- =============================================================================
-- 2. Holding Admin Full Override Policies (FOR ALL = SELECT, INSERT, UPDATE, DELETE)
--    Holding admins can do anything on all business tables.
-- =============================================================================

-- ---- leads ----
DROP POLICY IF EXISTS holding_override_leads ON leads;
CREATE POLICY holding_override_leads ON leads FOR ALL
    USING (is_holding_admin()) WITH CHECK (is_holding_admin());

-- ---- offers ----
DROP POLICY IF EXISTS holding_override_offers ON offers;
CREATE POLICY holding_override_offers ON offers FOR ALL
    USING (is_holding_admin()) WITH CHECK (is_holding_admin());

-- ---- calls ----
DROP POLICY IF EXISTS holding_override_calls ON calls;
CREATE POLICY holding_override_calls ON calls FOR ALL
    USING (is_holding_admin()) WITH CHECK (is_holding_admin());

-- ---- call_analysis ----
DROP POLICY IF EXISTS holding_override_call_analysis ON call_analysis;
CREATE POLICY holding_override_call_analysis ON call_analysis FOR ALL
    USING (is_holding_admin()) WITH CHECK (is_holding_admin());

-- ---- invoices ----
DROP POLICY IF EXISTS holding_override_invoices ON invoices;
CREATE POLICY holding_override_invoices ON invoices FOR ALL
    USING (is_holding_admin()) WITH CHECK (is_holding_admin());

-- ---- payments ----
DROP POLICY IF EXISTS holding_override_payments ON payments;
CREATE POLICY holding_override_payments ON payments FOR ALL
    USING (is_holding_admin()) WITH CHECK (is_holding_admin());

-- ---- projects ----
DROP POLICY IF EXISTS holding_override_projects ON projects;
CREATE POLICY holding_override_projects ON projects FOR ALL
    USING (is_holding_admin()) WITH CHECK (is_holding_admin());

-- ---- project_phase_history ----
DROP POLICY IF EXISTS holding_override_project_phase_history ON project_phase_history;
CREATE POLICY holding_override_project_phase_history ON project_phase_history FOR ALL
    USING (is_holding_admin()) WITH CHECK (is_holding_admin());

-- ---- calendar_events ----
DROP POLICY IF EXISTS holding_override_calendar_events ON calendar_events;
CREATE POLICY holding_override_calendar_events ON calendar_events FOR ALL
    USING (is_holding_admin()) WITH CHECK (is_holding_admin());

-- ---- team_members ----
DROP POLICY IF EXISTS holding_override_team_members ON team_members;
CREATE POLICY holding_override_team_members ON team_members FOR ALL
    USING (is_holding_admin()) WITH CHECK (is_holding_admin());

-- ---- connectors ----
DROP POLICY IF EXISTS holding_override_connectors ON connectors;
CREATE POLICY holding_override_connectors ON connectors FOR ALL
    USING (is_holding_admin()) WITH CHECK (is_holding_admin());

-- ---- cashflow_entries ----
DROP POLICY IF EXISTS holding_override_cashflow_entries ON cashflow_entries;
CREATE POLICY holding_override_cashflow_entries ON cashflow_entries FOR ALL
    USING (is_holding_admin()) WITH CHECK (is_holding_admin());

-- ---- cashflow_uploads ----
DROP POLICY IF EXISTS holding_override_cashflow_uploads ON cashflow_uploads;
CREATE POLICY holding_override_cashflow_uploads ON cashflow_uploads FOR ALL
    USING (is_holding_admin()) WITH CHECK (is_holding_admin());

-- ---- kpi_snapshots ----
DROP POLICY IF EXISTS holding_override_kpi_snapshots ON kpi_snapshots;
CREATE POLICY holding_override_kpi_snapshots ON kpi_snapshots FOR ALL
    USING (is_holding_admin()) WITH CHECK (is_holding_admin());

-- ---- offer_notes ----
DROP POLICY IF EXISTS holding_override_offer_notes ON offer_notes;
CREATE POLICY holding_override_offer_notes ON offer_notes FOR ALL
    USING (is_holding_admin()) WITH CHECK (is_holding_admin());

-- ---- call_scripts ----
DROP POLICY IF EXISTS holding_override_call_scripts ON call_scripts;
CREATE POLICY holding_override_call_scripts ON call_scripts FOR ALL
    USING (is_holding_admin()) WITH CHECK (is_holding_admin());

-- ---- connector_sync_log ----
DROP POLICY IF EXISTS holding_override_connector_sync_log ON connector_sync_log;
CREATE POLICY holding_override_connector_sync_log ON connector_sync_log FOR ALL
    USING (is_holding_admin()) WITH CHECK (is_holding_admin());

-- ---- phase_definitions ----
DROP POLICY IF EXISTS holding_override_phase_definitions ON phase_definitions;
CREATE POLICY holding_override_phase_definitions ON phase_definitions FOR ALL
    USING (is_holding_admin()) WITH CHECK (is_holding_admin());

-- =============================================================================
-- 3. Finance Table Permission-Gated Policies
--    SELECT on finance tables requires module:finance:read permission.
--    These replace the basic tenant_select policies from 002 for finance tables.
-- =============================================================================

-- ---- invoices: permission-gated SELECT ----
DROP POLICY IF EXISTS invoices_tenant_select ON invoices;
CREATE POLICY invoices_tenant_select ON invoices FOR SELECT USING (
    tenant_id = current_tenant_id() AND has_permission('module:finance:read')
);

-- ---- payments: permission-gated SELECT ----
DROP POLICY IF EXISTS payments_tenant_select ON payments;
CREATE POLICY payments_tenant_select ON payments FOR SELECT USING (
    tenant_id = current_tenant_id() AND has_permission('module:finance:read')
);

-- ---- cashflow_entries: permission-gated SELECT ----
DROP POLICY IF EXISTS cashflow_entries_tenant_select ON cashflow_entries;
CREATE POLICY cashflow_entries_tenant_select ON cashflow_entries FOR SELECT USING (
    tenant_id = current_tenant_id() AND has_permission('module:finance:read')
);

-- ---- cashflow_uploads: permission-gated SELECT ----
DROP POLICY IF EXISTS cashflow_uploads_tenant_select ON cashflow_uploads;
CREATE POLICY cashflow_uploads_tenant_select ON cashflow_uploads FOR SELECT USING (
    tenant_id = current_tenant_id() AND has_permission('module:finance:read')
);

-- =============================================================================
-- 4. AI / Call Analysis Permission-Gated Policy
--    SELECT on call_analysis requires module:ai:read permission.
-- =============================================================================

-- Replace the basic tenant_select with a permission-gated version
DROP POLICY IF EXISTS call_analysis_tenant_select ON call_analysis;
CREATE POLICY call_analysis_tenant_select ON call_analysis FOR SELECT USING (
    tenant_id = current_tenant_id() AND has_permission('module:ai:read')
);

-- =============================================================================
-- 5. Connector Admin-Gated Policies
--    Connectors are only visible to users with module:admin:read permission.
-- =============================================================================

-- Replace basic connector select with admin-gated version
DROP POLICY IF EXISTS connectors_tenant_select ON connectors;
CREATE POLICY connectors_tenant_select ON connectors FOR SELECT USING (
    tenant_id = current_tenant_id() AND has_permission('module:admin:read')
);

-- Connector insert/update require admin:write
DROP POLICY IF EXISTS connectors_tenant_insert ON connectors;
CREATE POLICY connectors_tenant_insert ON connectors FOR INSERT WITH CHECK (
    tenant_id = current_tenant_id() AND has_permission('module:admin:write')
);

DROP POLICY IF EXISTS connectors_tenant_update ON connectors;
CREATE POLICY connectors_tenant_update ON connectors FOR UPDATE USING (
    tenant_id = current_tenant_id() AND has_permission('module:admin:write')
);

-- Connector sync logs also require admin:read
DROP POLICY IF EXISTS connector_sync_log_tenant_select ON connector_sync_log;
CREATE POLICY connector_sync_log_tenant_select ON connector_sync_log FOR SELECT USING (
    tenant_id = current_tenant_id() AND has_permission('module:admin:read')
);

-- =============================================================================
-- End of Migration 003
-- =============================================================================


-- ====== 004_daily_reports.sql ======
-- Migration 004: Daily reports archive and tenant settings
-- Phase 5 â€” AI Pipeline

-- Daily reports archive
CREATE TABLE IF NOT EXISTS public.daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  report_json JSONB NOT NULL,
  kpi_data JSONB NOT NULL,
  sent_to TEXT[] NOT NULL DEFAULT '{}',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, report_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_reports_tenant_date
  ON public.daily_reports (tenant_id, report_date DESC);

ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_daily_reports" ON public.daily_reports FOR SELECT
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('module:reports:read')
  );

CREATE POLICY "holding_daily_reports" ON public.daily_reports FOR ALL
  USING (public.is_holding_admin())
  WITH CHECK (public.is_holding_admin());

-- Service role can insert (report worker)
CREATE POLICY "service_insert_daily_reports" ON public.daily_reports FOR INSERT
  WITH CHECK (true);


-- ====== 005_tenant_settings.sql ======
-- Migration 005: Tenant settings for report configuration
-- Phase 5 â€” AI Pipeline

CREATE TABLE IF NOT EXISTS public.tenant_settings (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  report_send_time TIME NOT NULL DEFAULT '07:00:00',
  report_timezone TEXT NOT NULL DEFAULT 'Europe/Zurich',
  report_recipients_all BOOLEAN NOT NULL DEFAULT FALSE,
  stalled_project_days INTEGER NOT NULL DEFAULT 7,
  unworked_lead_hours INTEGER NOT NULL DEFAULT 4,
  max_whisper_usd_monthly NUMERIC(10,2) NOT NULL DEFAULT 50.00,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_settings_read" ON public.tenant_settings FOR SELECT
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('module:admin:read')
  );

CREATE POLICY "tenant_settings_write" ON public.tenant_settings FOR UPDATE
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('module:admin:write')
  );

CREATE POLICY "holding_tenant_settings" ON public.tenant_settings FOR ALL
  USING (public.is_holding_admin())
  WITH CHECK (public.is_holding_admin());

-- Service role insert for auto-creation
CREATE POLICY "service_insert_tenant_settings" ON public.tenant_settings FOR INSERT
  WITH CHECK (true);

-- Auto-create settings row when tenant is created
CREATE OR REPLACE FUNCTION public.init_tenant_settings()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.tenant_settings (tenant_id)
  VALUES (NEW.id)
  ON CONFLICT (tenant_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_init_tenant_settings ON public.tenants;
CREATE TRIGGER trg_init_tenant_settings
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.init_tenant_settings();

-- Transcription usage tracking
CREATE TABLE IF NOT EXISTS public.transcription_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  total_minutes NUMERIC(10,2) NOT NULL DEFAULT 0,
  estimated_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, month)
);

ALTER TABLE public.transcription_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_transcription_usage" ON public.transcription_usage FOR SELECT
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "holding_transcription_usage" ON public.transcription_usage FOR ALL
  USING (public.is_holding_admin())
  WITH CHECK (public.is_holding_admin());

CREATE POLICY "service_transcription_usage" ON public.transcription_usage FOR ALL
  WITH CHECK (true);

-- Add updated_at trigger
CREATE TRIGGER set_updated_at_tenant_settings
  BEFORE UPDATE ON public.tenant_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Also add additional columns to call_analysis if not present
DO $$ BEGIN
  ALTER TABLE public.call_analysis ADD COLUMN IF NOT EXISTS manual_override BOOLEAN DEFAULT FALSE;
  ALTER TABLE public.call_analysis ADD COLUMN IF NOT EXISTS override_by UUID REFERENCES public.profiles(id);
  ALTER TABLE public.call_analysis ADD COLUMN IF NOT EXISTS override_notes TEXT;
  ALTER TABLE public.call_analysis ADD COLUMN IF NOT EXISTS override_at TIMESTAMPTZ;
  ALTER TABLE public.call_analysis ADD COLUMN IF NOT EXISTS transcript_language TEXT DEFAULT 'de';
  ALTER TABLE public.call_analysis ADD COLUMN IF NOT EXISTS transcribed_at TIMESTAMPTZ;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Add new permission for daily reports
INSERT INTO public.permissions (key, label, description) VALUES
  ('module:reports:daily', 'Tagesbericht', 'TÃ¤glichen Coaching-Bericht erhalten'),
  ('module:ai:callanalysis', 'KI-Anrufanalyse', 'KI-Anrufanalysen einsehen')
ON CONFLICT (key) DO NOTHING;


-- ====== 006_whatsapp.sql ======
-- =============================================================================
-- Migration 006: WhatsApp Messages Table
-- Enura Group Multi-Tenant BI Platform
--
-- Contains: whatsapp_messages table with RLS, indexes, and TimescaleDB hypertable.
-- Idempotent: safe to run multiple times.
-- =============================================================================

-- =============================================================================
-- 1. Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    external_id       TEXT NOT NULL,
    wa_id             TEXT NOT NULL,
    direction         call_direction NOT NULL,
    message_type      TEXT NOT NULL DEFAULT 'text',
    body              TEXT,
    team_member_id    UUID REFERENCES team_members(id) ON DELETE SET NULL,
    lead_id           UUID REFERENCES leads(id) ON DELETE SET NULL,
    sent_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, external_id)
);

-- =============================================================================
-- 2. TimescaleDB Hypertable (with fallback to BRIN index)
-- =============================================================================

DO $$ BEGIN
    PERFORM create_hypertable('whatsapp_messages', 'sent_at', if_not_exists => TRUE);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'TimescaleDB not available for whatsapp_messages, using BRIN index instead.';
    CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_sent_at_brin ON whatsapp_messages USING BRIN (sent_at);
END $$;

-- =============================================================================
-- 3. Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_tenant_sent_at
    ON whatsapp_messages (tenant_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_team_member
    ON whatsapp_messages (team_member_id)
    WHERE team_member_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_lead
    ON whatsapp_messages (lead_id)
    WHERE lead_id IS NOT NULL;

-- =============================================================================
-- 4. Row-Level Security
-- =============================================================================

ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Holding admin full override
DROP POLICY IF EXISTS holding_override_whatsapp_messages ON whatsapp_messages;
CREATE POLICY holding_override_whatsapp_messages ON whatsapp_messages FOR ALL
    USING (is_holding_admin()) WITH CHECK (is_holding_admin());

-- Tenant isolation: SELECT
DROP POLICY IF EXISTS whatsapp_messages_tenant_select ON whatsapp_messages;
CREATE POLICY whatsapp_messages_tenant_select ON whatsapp_messages FOR SELECT USING (
    tenant_id = current_tenant_id()
);

-- Tenant isolation: INSERT
DROP POLICY IF EXISTS whatsapp_messages_tenant_insert ON whatsapp_messages;
CREATE POLICY whatsapp_messages_tenant_insert ON whatsapp_messages FOR INSERT WITH CHECK (
    tenant_id = current_tenant_id()
);

-- Tenant isolation: UPDATE
DROP POLICY IF EXISTS whatsapp_messages_tenant_update ON whatsapp_messages;
CREATE POLICY whatsapp_messages_tenant_update ON whatsapp_messages FOR UPDATE USING (
    tenant_id = current_tenant_id()
);


-- ====== 007_email_activity.sql ======
-- =============================================================================
-- Migration 007: Email Activity Table
-- Enura Group Multi-Tenant BI Platform
--
-- Contains: email_activity table for Gmail connector daily aggregates.
-- Stores only counts â€” never email content.
-- Idempotent: safe to run multiple times.
-- =============================================================================

-- =============================================================================
-- 1. Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS email_activity (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    team_member_id    UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    activity_date     DATE NOT NULL,
    emails_sent       INTEGER NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, team_member_id, activity_date)
);

-- =============================================================================
-- 2. Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_email_activity_tenant_date
    ON email_activity (tenant_id, activity_date DESC);

CREATE INDEX IF NOT EXISTS idx_email_activity_team_member
    ON email_activity (team_member_id, activity_date DESC);

-- =============================================================================
-- 3. Row-Level Security
-- =============================================================================

ALTER TABLE email_activity ENABLE ROW LEVEL SECURITY;

-- Holding admin full override
DROP POLICY IF EXISTS holding_override_email_activity ON email_activity;
CREATE POLICY holding_override_email_activity ON email_activity FOR ALL
    USING (is_holding_admin()) WITH CHECK (is_holding_admin());

-- Tenant isolation: SELECT
DROP POLICY IF EXISTS email_activity_tenant_select ON email_activity;
CREATE POLICY email_activity_tenant_select ON email_activity FOR SELECT USING (
    tenant_id = current_tenant_id()
);

-- Tenant isolation: INSERT
DROP POLICY IF EXISTS email_activity_tenant_insert ON email_activity;
CREATE POLICY email_activity_tenant_insert ON email_activity FOR INSERT WITH CHECK (
    tenant_id = current_tenant_id()
);

-- Tenant isolation: UPDATE
DROP POLICY IF EXISTS email_activity_tenant_update ON email_activity;
CREATE POLICY email_activity_tenant_update ON email_activity FOR UPDATE USING (
    tenant_id = current_tenant_id()
);


-- ====== 008_anomalies.sql ======
-- =============================================================================
-- Migration 008: Anomaly detection table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical','warning','info')),
  entity_id UUID,
  entity_name TEXT,
  metric TEXT NOT NULL,
  current_value NUMERIC NOT NULL,
  baseline_value NUMERIC NOT NULL,
  deviation_pct NUMERIC NOT NULL,
  message TEXT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notified BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE public.anomalies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_anomalies" ON public.anomalies FOR SELECT
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "holding_anomalies" ON public.anomalies FOR ALL
  USING (public.is_holding_admin()) WITH CHECK (public.is_holding_admin());

CREATE POLICY "service_anomalies" ON public.anomalies FOR ALL
  USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');

CREATE INDEX IF NOT EXISTS idx_anomalies_active
  ON public.anomalies (tenant_id, is_active, detected_at DESC) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_anomalies_type
  ON public.anomalies (tenant_id, type, is_active);


-- ====== 009_impersonation.sql ======
-- =============================================================================
-- Migration 009: Impersonation sessions for holding admins
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.impersonation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.profiles(id),
  target_user_id UUID NOT NULL REFERENCES public.profiles(id),
  reason TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- No RLS â€” only accessible via service role


-- ====== 011_introduce_holdings.sql ======
-- ============================================================
-- Migration 011 â€” Introduce Holdings Layer
-- Adds the Holdings table and the Enura Group meta-level.
-- Safe to run on existing data â€” adds new structures only.
-- ============================================================

-- 1. Enura Group meta-level config (single row)
CREATE TABLE IF NOT EXISTS public.enura_platform (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL DEFAULT 'Enura Group',
  secret_management    TEXT NOT NULL DEFAULT 'holding_only',
  tool_registry        TEXT NOT NULL DEFAULT 'holding_only',
  template_management  TEXT NOT NULL DEFAULT 'holding_only',
  permission_matrix    TEXT NOT NULL DEFAULT 'holding_only',
  default_language     TEXT NOT NULL DEFAULT 'de',
  default_locale       TEXT NOT NULL DEFAULT 'de-CH',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.enura_platform (id)
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- 2. Holdings table
CREATE TABLE IF NOT EXISTS public.holdings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  slug             TEXT NOT NULL UNIQUE,
  status           TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active','suspended','archived')),
  branding         JSONB NOT NULL DEFAULT '{
    "primary": "#1A56DB", "secondary": "#1A1A1A", "accent": "#F3A917",
    "background": "#FFFFFF", "surface": "#F9FAFB",
    "textPrimary": "#111827", "textSecondary": "#6B7280",
    "font": "Inter", "fontUrl": null, "radius": "8px",
    "darkModeEnabled": true, "language": "de", "locale": "de-CH",
    "dateFormat": "DD.MM.YYYY", "numberFormat": "de-CH",
    "currencyDisplay": "CHF", "availableLanguages": ["de"],
    "fallbackLanguage": "de"
  }'::jsonb,
  primary_domain   TEXT,
  permission_matrix JSONB NOT NULL DEFAULT '{
    "process_create_structural": false,
    "process_edit_redactional": true,
    "process_deploy": false,
    "user_management": true
  }'::jsonb,
  created_by       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Domain mappings
CREATE TABLE IF NOT EXISTS public.domain_mappings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain      TEXT NOT NULL UNIQUE,
  holding_id  UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id  UUID,
  ssl_status  TEXT NOT NULL DEFAULT 'pending'
                CHECK (ssl_status IN ('pending','active','error')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Holding admins v2 (tied to specific holdings)
CREATE TABLE IF NOT EXISTS public.holding_admins_v2 (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id  UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  profile_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_owner    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (holding_id, profile_id)
);

-- 5. Enura Group super-admins
CREATE TABLE IF NOT EXISTS public.enura_admins (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migrate existing holding_admins â†’ enura_admins
INSERT INTO public.enura_admins (profile_id, created_at)
SELECT profile_id, created_at
FROM   public.holding_admins
ON CONFLICT (profile_id) DO NOTHING;

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_holdings_slug       ON public.holdings (slug);
CREATE INDEX IF NOT EXISTS idx_holdings_status     ON public.holdings (status);
CREATE INDEX IF NOT EXISTS idx_domain_holding      ON public.domain_mappings (holding_id);
CREATE INDEX IF NOT EXISTS idx_holding_admins_v2   ON public.holding_admins_v2 (holding_id, profile_id);


-- ====== 012_rename_tenants_to_companies.sql ======
-- ============================================================
-- Migration 012 â€” Rename tenants â†’ companies
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

-- 4. Rename tenant_id â†’ company_id and add holding_id on all tables

-- profiles
ALTER TABLE public.profiles RENAME COLUMN tenant_id TO company_id;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS holding_id UUID REFERENCES public.holdings(id);
UPDATE public.profiles p SET holding_id = c.holding_id FROM public.companies c WHERE c.id = p.company_id;

-- roles
ALTER TABLE public.roles RENAME COLUMN tenant_id TO company_id;
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS holding_id UUID;
UPDATE public.roles r SET holding_id = c.holding_id FROM public.companies c WHERE c.id = r.company_id;

-- tenant_brandings â†’ company_branding
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

-- tenant_settings â†’ company_settings
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


-- ====== 013_update_rls_policies.sql ======
-- ============================================================
-- Migration 013 â€” Rewrite all RLS policies for three-tier model
-- ============================================================

-- 1. Updated helper functions

CREATE OR REPLACE FUNCTION public.is_enura_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.enura_admins WHERE profile_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_holding_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT holding_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_holding_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.holding_admins_v2
    WHERE profile_id = auth.uid()
      AND holding_id = public.current_holding_id()
  );
$$;

-- Backward compat alias
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT public.current_company_id();
$$;

-- 2. Drop ALL existing policies
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- 3. RLS on new tables
ALTER TABLE public.holdings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holding_admins_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enura_admins      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_mappings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enura_platform    ENABLE ROW LEVEL SECURITY;

-- 4. Holdings policies
CREATE POLICY "enura_admin_holdings" ON public.holdings FOR ALL USING (public.is_enura_admin());
CREATE POLICY "holding_admin_own_holding" ON public.holdings FOR SELECT USING (id = public.current_holding_id());

-- 5. Companies policies (PUBLIC select for login page tenant resolution)
CREATE POLICY "companies_public_select" ON public.companies FOR SELECT USING (true);
CREATE POLICY "enura_admin_companies" ON public.companies FOR ALL USING (public.is_enura_admin());
CREATE POLICY "holding_admin_companies" ON public.companies FOR ALL
  USING (holding_id = public.current_holding_id() AND public.is_holding_admin());

-- 6. Company branding (PUBLIC select for login page)
CREATE POLICY "company_branding_public_select" ON public.company_branding FOR SELECT USING (true);
CREATE POLICY "enura_admin_company_branding" ON public.company_branding FOR ALL USING (public.is_enura_admin());
CREATE POLICY "holding_admin_company_branding" ON public.company_branding FOR ALL
  USING (holding_id = public.current_holding_id() AND public.is_holding_admin());
CREATE POLICY "company_user_company_branding" ON public.company_branding FOR SELECT
  USING (company_id = public.current_company_id());

-- 7. Profiles
CREATE POLICY "enura_admin_profiles" ON public.profiles FOR ALL USING (public.is_enura_admin());
CREATE POLICY "holding_admin_profiles" ON public.profiles FOR SELECT
  USING (holding_id = public.current_holding_id() AND public.is_holding_admin());
CREATE POLICY "user_own_profile" ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "user_update_own_profile" ON public.profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "super_user_company_profiles" ON public.profiles FOR SELECT
  USING (company_id = public.current_company_id() AND public.has_permission('module:admin:users'));

-- 8. Three-tier policies for all business tables
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'leads','offers','offer_notes','calls','call_analysis','call_scripts',
    'invoices','payments','cashflow_uploads','cashflow_entries',
    'projects','project_phase_history','calendar_events','kpi_snapshots',
    'anomalies','daily_reports','team_members','connectors',
    'connector_sync_log','company_settings','roles','phase_definitions'
  ] LOOP
    EXECUTE format('CREATE POLICY "enura_admin_%s" ON public.%I FOR ALL USING (public.is_enura_admin())', tbl, tbl);
    EXECUTE format('CREATE POLICY "holding_admin_%s" ON public.%I FOR ALL USING (holding_id = public.current_holding_id() AND public.is_holding_admin())', tbl, tbl);
    EXECUTE format('CREATE POLICY "company_user_%s" ON public.%I FOR ALL USING (company_id = public.current_company_id())', tbl, tbl);
  END LOOP;
END $$;

-- Optional Phase 6 tables
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'whatsapp_messages' AND schemaname = 'public') THEN
    EXECUTE 'CREATE POLICY "enura_admin_whatsapp_messages" ON public.whatsapp_messages FOR ALL USING (public.is_enura_admin())';
    EXECUTE 'CREATE POLICY "holding_admin_whatsapp_messages" ON public.whatsapp_messages FOR ALL USING (holding_id = public.current_holding_id() AND public.is_holding_admin())';
    EXECUTE 'CREATE POLICY "company_user_whatsapp_messages" ON public.whatsapp_messages FOR ALL USING (company_id = public.current_company_id())';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'email_activity' AND schemaname = 'public') THEN
    EXECUTE 'CREATE POLICY "enura_admin_email_activity" ON public.email_activity FOR ALL USING (public.is_enura_admin())';
    EXECUTE 'CREATE POLICY "holding_admin_email_activity" ON public.email_activity FOR ALL USING (holding_id = public.current_holding_id() AND public.is_holding_admin())';
    EXECUTE 'CREATE POLICY "company_user_email_activity" ON public.email_activity FOR ALL USING (company_id = public.current_company_id())';
  END IF;
END $$;

-- 9. Audit log: append-only, read by holding+
CREATE POLICY "audit_log_insert" ON public.audit_log FOR INSERT WITH CHECK (true);
CREATE POLICY "audit_log_read_holding" ON public.audit_log FOR SELECT
  USING (holding_id = public.current_holding_id() AND (public.is_holding_admin() OR public.is_enura_admin()));
CREATE POLICY "audit_log_read_company" ON public.audit_log FOR SELECT
  USING (company_id = public.current_company_id() AND public.has_permission('module:admin:users'));
CREATE POLICY "enura_admin_audit_log" ON public.audit_log FOR SELECT USING (public.is_enura_admin());

-- Append-only enforcement
DO $$ BEGIN
  CREATE RULE no_update_audit_log AS ON UPDATE TO public.audit_log DO INSTEAD NOTHING;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE RULE no_delete_audit_log AS ON DELETE TO public.audit_log DO INSTEAD NOTHING;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 10. Permissions / role_permissions: readable by all authenticated
CREATE POLICY "permissions_readable" ON public.permissions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "role_permissions_readable" ON public.role_permissions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "profile_roles_readable" ON public.profile_roles FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "profile_roles_insert" ON public.profile_roles FOR INSERT WITH CHECK (true);
CREATE POLICY "profile_roles_delete" ON public.profile_roles FOR DELETE USING (true);

-- 11. Holding admin / enura admin / domain tables
CREATE POLICY "enura_admin_holding_admins_v2" ON public.holding_admins_v2 FOR ALL USING (public.is_enura_admin());
CREATE POLICY "holding_admin_own_admins" ON public.holding_admins_v2 FOR SELECT
  USING (holding_id = public.current_holding_id() AND public.is_holding_admin());

CREATE POLICY "enura_admin_enura_admins" ON public.enura_admins FOR ALL USING (public.is_enura_admin());

CREATE POLICY "enura_admin_domain_mappings" ON public.domain_mappings FOR ALL USING (public.is_enura_admin());
CREATE POLICY "holding_admin_domain_mappings" ON public.domain_mappings FOR ALL
  USING (holding_id = public.current_holding_id() AND public.is_holding_admin());

CREATE POLICY "enura_admin_platform" ON public.enura_platform FOR ALL USING (public.is_enura_admin());

-- 12. Holding admins (old table, kept for backward compat)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'holding_admins' AND schemaname = 'public') THEN
    EXECUTE 'CREATE POLICY "enura_admin_holding_admins" ON public.holding_admins FOR ALL USING (public.is_enura_admin())';
  END IF;
END $$;

-- 13. Impersonation sessions
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'impersonation_sessions' AND schemaname = 'public') THEN
    EXECUTE 'CREATE POLICY "enura_admin_impersonation" ON public.impersonation_sessions FOR ALL USING (public.is_enura_admin())';
  END IF;
END $$;

-- 14. Profile roles (user_roles alias)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'user_roles' AND schemaname = 'public') THEN
    EXECUTE 'CREATE POLICY "enura_admin_user_roles" ON public.user_roles FOR ALL USING (public.is_enura_admin())';
    EXECUTE 'CREATE POLICY "user_own_user_roles" ON public.user_roles FOR SELECT USING (profile_id = auth.uid())';
  END IF;
END $$;


-- ====== 014_update_triggers_and_functions.sql ======
-- ============================================================
-- Migration 014 â€” Update triggers and functions for three-tier
-- ============================================================

-- 0. Ensure set_updated_at function exists
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 1. Update init_company_branding trigger (was init_tenant_branding)
DROP TRIGGER IF EXISTS trg_init_tenant_branding ON public.companies;
DROP TRIGGER IF EXISTS create_tenant_branding ON public.companies;
DROP FUNCTION IF EXISTS public.init_tenant_branding();

CREATE OR REPLACE FUNCTION public.init_company_branding()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.company_branding (company_id, holding_id)
  VALUES (NEW.id, NEW.holding_id)
  ON CONFLICT (company_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_init_company_branding ON public.companies;
CREATE TRIGGER trg_init_company_branding
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.init_company_branding();

-- 2. Update seed_company_roles trigger (was seed_tenant_roles)
DROP TRIGGER IF EXISTS trg_seed_tenant_roles ON public.companies;
DROP TRIGGER IF EXISTS create_tenant_roles ON public.companies;
DROP FUNCTION IF EXISTS public.seed_tenant_roles();

CREATE OR REPLACE FUNCTION public.seed_company_roles()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_super_role_id UUID;
BEGIN
  INSERT INTO public.roles (company_id, holding_id, name, label, is_super, is_system)
  VALUES (NEW.id, NEW.holding_id, 'super_user', 'Super User', TRUE, TRUE)
  RETURNING id INTO v_super_role_id;

  INSERT INTO public.roles (company_id, holding_id, name, label, is_system) VALUES
    (NEW.id, NEW.holding_id, 'geschaeftsfuehrung', 'GeschÃ¤ftsfÃ¼hrung',    TRUE),
    (NEW.id, NEW.holding_id, 'teamleiter',         'Teamleiter',           TRUE),
    (NEW.id, NEW.holding_id, 'setter',             'Setter',               TRUE),
    (NEW.id, NEW.holding_id, 'berater',            'Berater',              TRUE),
    (NEW.id, NEW.holding_id, 'innendienst',        'Innendienst',          TRUE),
    (NEW.id, NEW.holding_id, 'bau',                'Bau / Montage',        TRUE),
    (NEW.id, NEW.holding_id, 'buchhaltung',        'Buchhaltung',          TRUE),
    (NEW.id, NEW.holding_id, 'leadkontrolle',      'Leadkontrolle',        TRUE);

  -- Assign all permissions to super_user
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_super_role_id, id FROM public.permissions;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_company_roles ON public.companies;
CREATE TRIGGER trg_seed_company_roles
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.seed_company_roles();

-- 3. Update init_company_settings trigger (was init_tenant_settings)
DROP TRIGGER IF EXISTS trg_init_tenant_settings ON public.companies;
DROP FUNCTION IF EXISTS public.init_tenant_settings();

CREATE OR REPLACE FUNCTION public.init_company_settings()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.company_settings (company_id, holding_id)
  VALUES (NEW.id, NEW.holding_id)
  ON CONFLICT (company_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_init_company_settings ON public.companies;
CREATE TRIGGER trg_init_company_settings
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.init_company_settings();

-- 4. updated_at triggers on new tables
DROP TRIGGER IF EXISTS trg_holdings_updated_at ON public.holdings;
CREATE TRIGGER trg_holdings_updated_at
  BEFORE UPDATE ON public.holdings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Companies already has updated_at trigger from migration 001 (was on tenants)
-- Just ensure it exists
DROP TRIGGER IF EXISTS set_updated_at ON public.companies;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Keep current_tenant_id() as backward compat (already done in 013)
-- Just ensure it exists
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT public.current_company_id();
$$;

-- 6. Keep is_holding_admin() backward compat â€” also check old table
CREATE OR REPLACE FUNCTION public.is_holding_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.holding_admins_v2
    WHERE profile_id = auth.uid()
      AND holding_id = public.current_holding_id()
  )
  OR EXISTS (
    SELECT 1 FROM public.holding_admins
    WHERE profile_id = auth.uid()
  );
$$;


-- ====== 015_process_builder.sql ======
-- ============================================================
-- Migration 015 â€” Process Builder
-- Tables for the Enura Platform Process Builder: secrets,
-- tool registry, process templates, definitions, steps,
-- sources, interfaces, liquidity, versions, deployments,
-- and company currency settings.
-- ============================================================

-- ============================================================
-- 1. holding_secrets â€” holding-level secret metadata
-- ============================================================
CREATE TABLE IF NOT EXISTS public.holding_secrets (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id             UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  name                   TEXT NOT NULL,
  secret_type            TEXT NOT NULL CHECK (secret_type IN ('api_key','oauth2_token','service_account','certificate','password','webhook_secret')),
  scope                  TEXT NOT NULL DEFAULT 'global',
  vault_id               UUID,
  description            TEXT,
  is_active              BOOLEAN NOT NULL DEFAULT TRUE,
  created_by             UUID REFERENCES public.profiles(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_rotated_at        TIMESTAMPTZ,
  rotation_interval_days INTEGER,
  next_rotation_due      DATE,
  UNIQUE (holding_id, name)
);

-- ============================================================
-- 2. secret_access_log â€” append-only audit trail
-- ============================================================
CREATE TABLE IF NOT EXISTS public.secret_access_log (
  id            BIGSERIAL PRIMARY KEY,
  holding_id    UUID NOT NULL,
  secret_id     UUID NOT NULL REFERENCES public.holding_secrets(id) ON DELETE CASCADE,
  accessed_by   TEXT NOT NULL,
  context       TEXT,
  accessed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. tool_registry â€” available external tools per holding
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tool_registry (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id           UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  slug                 TEXT NOT NULL,
  category             TEXT NOT NULL CHECK (category IN ('crm','telephony','accounting','calendar','lead_aggregation','messaging','email','storage','analytics','custom')),
  base_url             TEXT,
  auth_type            TEXT NOT NULL CHECK (auth_type IN ('api_key','oauth2','service_account','webhook','none')),
  secret_ref           TEXT,
  default_headers      JSONB NOT NULL DEFAULT '{}'::jsonb,
  interface_templates  JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  icon_url             TEXT,
  docs_url             TEXT,
  created_by           UUID REFERENCES public.profiles(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (holding_id, slug)
);

-- ============================================================
-- 4. process_templates â€” group-wide reusable templates
-- ============================================================
CREATE TABLE IF NOT EXISTS public.process_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  description  TEXT,
  category     TEXT NOT NULL CHECK (category IN ('sales','operations','finance','hr','support','custom')),
  steps        JSONB NOT NULL DEFAULT '[]'::jsonb,
  version      TEXT NOT NULL DEFAULT '1.0.0',
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_by   UUID REFERENCES public.profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. process_definitions â€” per holding / company
-- ============================================================
CREATE TABLE IF NOT EXISTS public.process_definitions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id       UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id       UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  template_id      UUID REFERENCES public.process_templates(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  description      TEXT,
  category         TEXT NOT NULL CHECK (category IN ('sales','operations','finance','hr','support','custom')),
  menu_label       TEXT,
  menu_icon        TEXT,
  menu_sort_order  INTEGER DEFAULT 0,
  visible_roles    TEXT[] NOT NULL DEFAULT '{}',
  status           TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','finalised','pending_approval','deployed','archived')),
  version          TEXT NOT NULL DEFAULT '1.0.0',
  deployed_at      TIMESTAMPTZ,
  deployed_version TEXT,
  created_by       UUID REFERENCES public.profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (holding_id, company_id, name)
);

-- ============================================================
-- 6. process_steps â€” individual steps within a process
-- ============================================================
CREATE TABLE IF NOT EXISTS public.process_steps (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id        UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id        UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  process_id        UUID NOT NULL REFERENCES public.process_definitions(id) ON DELETE CASCADE,
  process_step_id   TEXT NOT NULL,
  name              TEXT NOT NULL,
  main_process      TEXT NOT NULL CHECK (main_process IN ('sales','operations','finance','hr','support','custom')),
  description       TEXT,
  responsible_roles TEXT[] NOT NULL DEFAULT '{}',
  expected_output   TEXT,
  typical_hours     INTEGER,
  warning_days      INTEGER,
  show_in_flowchart BOOLEAN NOT NULL DEFAULT TRUE,
  liquidity_marker  TEXT CHECK (liquidity_marker IS NULL OR liquidity_marker IN ('trigger','event')),
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (process_id, process_step_id)
);

-- ============================================================
-- 7. process_step_sources â€” data sources for a step
-- ============================================================
CREATE TABLE IF NOT EXISTS public.process_step_sources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id    UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id    UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  process_id    UUID NOT NULL REFERENCES public.process_definitions(id) ON DELETE CASCADE,
  step_id       UUID NOT NULL REFERENCES public.process_steps(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,
  source_type   TEXT NOT NULL CHECK (source_type IN ('api','database','file','manual','webhook','calculated')),
  tool_name     TEXT,
  endpoint      TEXT,
  description   TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- 8. process_step_interfaces â€” API/integration interfaces
-- ============================================================
CREATE TABLE IF NOT EXISTS public.process_step_interfaces (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id        UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id        UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  process_id        UUID NOT NULL REFERENCES public.process_definitions(id) ON DELETE CASCADE,
  step_id           UUID NOT NULL REFERENCES public.process_steps(id) ON DELETE CASCADE,
  label             TEXT NOT NULL,
  interface_type    TEXT NOT NULL CHECK (interface_type IN ('inbound','outbound','bidirectional')),
  protocol          TEXT NOT NULL CHECK (protocol IN ('rest','graphql','grpc','webhook','file','manual')),
  tool_registry_id  UUID REFERENCES public.tool_registry(id) ON DELETE SET NULL,
  endpoint          TEXT,
  http_method       TEXT CHECK (http_method IS NULL OR http_method IN ('GET','POST','PUT','PATCH','DELETE')),
  request_schema    JSONB,
  response_schema   JSONB,
  field_mapping     JSONB,
  secret_ref        TEXT,
  sync_interval_min INTEGER,
  trigger_condition TEXT,
  retry_policy      TEXT NOT NULL DEFAULT 'exponential_backoff'
                      CHECK (retry_policy IN ('none','fixed','exponential_backoff','linear')),
  timeout_sec       INTEGER DEFAULT 30,
  sort_order        INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- 9. process_step_liquidity â€” liquidity markers per step
-- ============================================================
CREATE TABLE IF NOT EXISTS public.process_step_liquidity (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id       UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id       UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  process_id       UUID NOT NULL REFERENCES public.process_definitions(id) ON DELETE CASCADE,
  step_id          UUID NOT NULL UNIQUE REFERENCES public.process_steps(id) ON DELETE CASCADE,
  marker_type      TEXT NOT NULL CHECK (marker_type IN ('trigger','event')),
  trigger_step_id  UUID REFERENCES public.process_steps(id),
  event_step_id    UUID REFERENCES public.process_steps(id),
  direction        TEXT NOT NULL CHECK (direction IN ('income','expense')),
  plan_currency    TEXT NOT NULL DEFAULT 'CHF',
  plan_amount      NUMERIC(14,2),
  amount_type      TEXT NOT NULL DEFAULT 'fixed' CHECK (amount_type IN ('fixed','percentage')),
  actual_currency  TEXT,
  fx_rate          NUMERIC,
  fx_rate_date     DATE,
  plan_delay_days  INTEGER DEFAULT 0,
  plan_date        DATE,
  actual_date      DATE,
  actual_amount    NUMERIC(14,2),
  source_tool      TEXT
);

-- ============================================================
-- 10. company_currency_settings â€” FX configuration per company
-- ============================================================
CREATE TABLE IF NOT EXISTS public.company_currency_settings (
  company_id          UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  holding_id          UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  base_currency       TEXT NOT NULL DEFAULT 'CHF',
  enabled_currencies  TEXT[] NOT NULL DEFAULT ARRAY['CHF','EUR'],
  eur_chf_rate        NUMERIC,
  rate_updated_at     DATE,
  fx_source           TEXT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 11. process_versions â€” snapshot history
-- ============================================================
CREATE TABLE IF NOT EXISTS public.process_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id      UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  process_id      UUID NOT NULL REFERENCES public.process_definitions(id) ON DELETE CASCADE,
  version         TEXT NOT NULL,
  snapshot        JSONB NOT NULL DEFAULT '{}'::jsonb,
  change_summary  TEXT,
  created_by      UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (process_id, version)
);

-- ============================================================
-- 12. process_deployments â€” deployment workflow
-- ============================================================
CREATE TABLE IF NOT EXISTS public.process_deployments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id     UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id     UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  process_id     UUID NOT NULL REFERENCES public.process_definitions(id) ON DELETE CASCADE,
  version        TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending_approval'
                   CHECK (status IN ('pending_approval','approved','rejected','deployed','rolled_back')),
  requested_by   UUID REFERENCES public.profiles(id),
  requested_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by    UUID REFERENCES public.profiles(id),
  reviewed_at    TIMESTAMPTZ,
  review_notes   TEXT,
  deployed_at    TIMESTAMPTZ,
  reason         TEXT,
  rollback_of    UUID REFERENCES public.process_deployments(id) ON DELETE SET NULL
);


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.holding_secrets           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secret_access_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_registry             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_templates         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_definitions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_steps             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_step_sources      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_step_interfaces   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_step_liquidity    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_currency_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_versions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_deployments       ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- RLS POLICIES
-- ============================================================

-- ---- holding_secrets: holding admin + enura admin only ----
CREATE POLICY "enura_admin_holding_secrets"
  ON public.holding_secrets FOR ALL
  USING (public.is_enura_admin());

CREATE POLICY "holding_admin_holding_secrets"
  ON public.holding_secrets FOR ALL
  USING (holding_id = public.current_holding_id() AND public.is_holding_admin());


-- ---- secret_access_log: append-only insert, holding admin + enura read ----
CREATE POLICY "secret_access_log_insert"
  ON public.secret_access_log FOR INSERT
  WITH CHECK (true);

CREATE POLICY "enura_admin_secret_access_log"
  ON public.secret_access_log FOR SELECT
  USING (public.is_enura_admin());

CREATE POLICY "holding_admin_secret_access_log"
  ON public.secret_access_log FOR SELECT
  USING (holding_id = public.current_holding_id() AND public.is_holding_admin());


-- ---- tool_registry: holding admin write, company users read active ----
CREATE POLICY "enura_admin_tool_registry"
  ON public.tool_registry FOR ALL
  USING (public.is_enura_admin());

CREATE POLICY "holding_admin_tool_registry"
  ON public.tool_registry FOR ALL
  USING (holding_id = public.current_holding_id() AND public.is_holding_admin());

CREATE POLICY "company_user_tool_registry_read"
  ON public.tool_registry FOR SELECT
  USING (holding_id = public.current_holding_id() AND is_active = TRUE);


-- ---- process_templates: authenticated read, holding admin + enura write ----
CREATE POLICY "authenticated_process_templates_read"
  ON public.process_templates FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "enura_admin_process_templates"
  ON public.process_templates FOR ALL
  USING (public.is_enura_admin());

CREATE POLICY "holding_admin_process_templates"
  ON public.process_templates FOR ALL
  USING (public.is_holding_admin());


-- ---- Process builder tables: holding admin + enura admin write, company user read ----
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'process_definitions','process_steps','process_step_sources',
    'process_step_interfaces','process_step_liquidity',
    'process_versions','process_deployments'
  ] LOOP
    -- Enura admin: full access
    EXECUTE format(
      'CREATE POLICY "enura_admin_%s" ON public.%I FOR ALL USING (public.is_enura_admin())',
      tbl, tbl
    );
    -- Holding admin: full access within own holding
    EXECUTE format(
      'CREATE POLICY "holding_admin_%s" ON public.%I FOR ALL USING (holding_id = public.current_holding_id() AND public.is_holding_admin())',
      tbl, tbl
    );
    -- Company user: read access within own company
    EXECUTE format(
      'CREATE POLICY "company_user_%s" ON public.%I FOR SELECT USING (company_id = public.current_company_id() OR (company_id IS NULL AND holding_id = public.current_holding_id()))',
      tbl, tbl
    );
  END LOOP;
END $$;


-- ---- company_currency_settings: company user + holding admin ----
CREATE POLICY "enura_admin_company_currency_settings"
  ON public.company_currency_settings FOR ALL
  USING (public.is_enura_admin());

CREATE POLICY "holding_admin_company_currency_settings"
  ON public.company_currency_settings FOR ALL
  USING (holding_id = public.current_holding_id() AND public.is_holding_admin());

CREATE POLICY "company_user_company_currency_settings"
  ON public.company_currency_settings FOR ALL
  USING (company_id = public.current_company_id());


-- ============================================================
-- INDEXES
-- ============================================================

-- holding_secrets
CREATE INDEX IF NOT EXISTS idx_holding_secrets_holding_id ON public.holding_secrets(holding_id);
CREATE INDEX IF NOT EXISTS idx_holding_secrets_active ON public.holding_secrets(holding_id, is_active) WHERE is_active = TRUE;

-- secret_access_log
CREATE INDEX IF NOT EXISTS idx_secret_access_log_holding_id ON public.secret_access_log(holding_id);
CREATE INDEX IF NOT EXISTS idx_secret_access_log_secret_id ON public.secret_access_log(secret_id);
CREATE INDEX IF NOT EXISTS idx_secret_access_log_accessed_at ON public.secret_access_log(accessed_at DESC);

-- tool_registry
CREATE INDEX IF NOT EXISTS idx_tool_registry_holding_id ON public.tool_registry(holding_id);
CREATE INDEX IF NOT EXISTS idx_tool_registry_category ON public.tool_registry(holding_id, category);
CREATE INDEX IF NOT EXISTS idx_tool_registry_active ON public.tool_registry(holding_id, is_active) WHERE is_active = TRUE;

-- process_templates
CREATE INDEX IF NOT EXISTS idx_process_templates_category ON public.process_templates(category);
CREATE INDEX IF NOT EXISTS idx_process_templates_active ON public.process_templates(is_active) WHERE is_active = TRUE;

-- process_definitions
CREATE INDEX IF NOT EXISTS idx_process_definitions_holding_id ON public.process_definitions(holding_id);
CREATE INDEX IF NOT EXISTS idx_process_definitions_company_id ON public.process_definitions(company_id);
CREATE INDEX IF NOT EXISTS idx_process_definitions_template_id ON public.process_definitions(template_id);
CREATE INDEX IF NOT EXISTS idx_process_definitions_status ON public.process_definitions(holding_id, status);
CREATE INDEX IF NOT EXISTS idx_process_definitions_category ON public.process_definitions(holding_id, category);

-- process_steps
CREATE INDEX IF NOT EXISTS idx_process_steps_process_id ON public.process_steps(process_id);
CREATE INDEX IF NOT EXISTS idx_process_steps_holding_id ON public.process_steps(holding_id);
CREATE INDEX IF NOT EXISTS idx_process_steps_company_id ON public.process_steps(company_id);
CREATE INDEX IF NOT EXISTS idx_process_steps_sort ON public.process_steps(process_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_process_steps_liquidity ON public.process_steps(process_id) WHERE liquidity_marker IS NOT NULL;

-- process_step_sources
CREATE INDEX IF NOT EXISTS idx_process_step_sources_step_id ON public.process_step_sources(step_id);
CREATE INDEX IF NOT EXISTS idx_process_step_sources_process_id ON public.process_step_sources(process_id);
CREATE INDEX IF NOT EXISTS idx_process_step_sources_holding_id ON public.process_step_sources(holding_id);

-- process_step_interfaces
CREATE INDEX IF NOT EXISTS idx_process_step_interfaces_step_id ON public.process_step_interfaces(step_id);
CREATE INDEX IF NOT EXISTS idx_process_step_interfaces_process_id ON public.process_step_interfaces(process_id);
CREATE INDEX IF NOT EXISTS idx_process_step_interfaces_holding_id ON public.process_step_interfaces(holding_id);
CREATE INDEX IF NOT EXISTS idx_process_step_interfaces_tool_registry_id ON public.process_step_interfaces(tool_registry_id);

-- process_step_liquidity
CREATE INDEX IF NOT EXISTS idx_process_step_liquidity_process_id ON public.process_step_liquidity(process_id);
CREATE INDEX IF NOT EXISTS idx_process_step_liquidity_holding_id ON public.process_step_liquidity(holding_id);
CREATE INDEX IF NOT EXISTS idx_process_step_liquidity_trigger_step ON public.process_step_liquidity(trigger_step_id);
CREATE INDEX IF NOT EXISTS idx_process_step_liquidity_event_step ON public.process_step_liquidity(event_step_id);

-- company_currency_settings
CREATE INDEX IF NOT EXISTS idx_company_currency_settings_holding_id ON public.company_currency_settings(holding_id);

-- process_versions
CREATE INDEX IF NOT EXISTS idx_process_versions_process_id ON public.process_versions(process_id);
CREATE INDEX IF NOT EXISTS idx_process_versions_holding_id ON public.process_versions(holding_id);
CREATE INDEX IF NOT EXISTS idx_process_versions_created_at ON public.process_versions(process_id, created_at DESC);

-- process_deployments
CREATE INDEX IF NOT EXISTS idx_process_deployments_process_id ON public.process_deployments(process_id);
CREATE INDEX IF NOT EXISTS idx_process_deployments_holding_id ON public.process_deployments(holding_id);
CREATE INDEX IF NOT EXISTS idx_process_deployments_company_id ON public.process_deployments(company_id);
CREATE INDEX IF NOT EXISTS idx_process_deployments_status ON public.process_deployments(status);
CREATE INDEX IF NOT EXISTS idx_process_deployments_rollback ON public.process_deployments(rollback_of);


-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS trg_set_updated_at_tool_registry ON public.tool_registry;
CREATE TRIGGER trg_set_updated_at_tool_registry
  BEFORE UPDATE ON public.tool_registry
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_process_definitions ON public.process_definitions;
CREATE TRIGGER trg_set_updated_at_process_definitions
  BEFORE UPDATE ON public.process_definitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_process_steps ON public.process_steps;
CREATE TRIGGER trg_set_updated_at_process_steps
  BEFORE UPDATE ON public.process_steps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_process_templates ON public.process_templates;
CREATE TRIGGER trg_set_updated_at_process_templates
  BEFORE UPDATE ON public.process_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_company_currency_settings ON public.company_currency_settings;
CREATE TRIGGER trg_set_updated_at_company_currency_settings
  BEFORE UPDATE ON public.company_currency_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ====== 016_seed_tool_registry.sql ======
-- ============================================================
-- Migration 016 â€” Seed Tool Registry
-- Populates default tools for the Default Holding.
-- ============================================================

INSERT INTO public.tool_registry (id, holding_id, name, slug, category, base_url, auth_type, secret_ref, default_headers, interface_templates, is_active, icon_url, docs_url)
VALUES
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000010',
    'Reonic CRM',
    'reonic-crm',
    'crm',
    'https://api.reonic.com/v1',
    'api_key',
    'reonic_api_key',
    '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb,
    '[
      {
        "name": "Fetch Leads",
        "interface_type": "inbound",
        "protocol": "rest",
        "endpoint": "/leads",
        "http_method": "GET",
        "description": "Retrieve leads from Reonic CRM",
        "sync_interval_min": 15
      },
      {
        "name": "Fetch Offers",
        "interface_type": "inbound",
        "protocol": "rest",
        "endpoint": "/offers",
        "http_method": "GET",
        "description": "Retrieve offers and closing data",
        "sync_interval_min": 15
      },
      {
        "name": "Fetch Projects",
        "interface_type": "inbound",
        "protocol": "rest",
        "endpoint": "/projects",
        "http_method": "GET",
        "description": "Retrieve project status and phases",
        "sync_interval_min": 15
      },
      {
        "name": "Update Lead Status",
        "interface_type": "outbound",
        "protocol": "rest",
        "endpoint": "/leads/{id}/status",
        "http_method": "PATCH",
        "description": "Push lead status updates back to Reonic"
      }
    ]'::jsonb,
    TRUE,
    NULL,
    'https://docs.reonic.com/api'
  ),
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000010',
    '3CX Cloud',
    '3cx-cloud',
    'telephony',
    'https://api.3cx.com/v1',
    'api_key',
    '3cx_api_key',
    '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb,
    '[
      {
        "name": "Fetch Call Logs",
        "interface_type": "inbound",
        "protocol": "rest",
        "endpoint": "/calls",
        "http_method": "GET",
        "description": "Retrieve call records and recordings",
        "sync_interval_min": 15
      },
      {
        "name": "Call Webhook",
        "interface_type": "inbound",
        "protocol": "webhook",
        "endpoint": "/webhooks/calls",
        "description": "Real-time call event notifications"
      }
    ]'::jsonb,
    TRUE,
    NULL,
    'https://www.3cx.com/docs/api/'
  ),
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000010',
    'Bexio',
    'bexio',
    'accounting',
    'https://api.bexio.com/3.0',
    'oauth2',
    'bexio_oauth2',
    '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb,
    '[
      {
        "name": "Fetch Invoices",
        "interface_type": "inbound",
        "protocol": "rest",
        "endpoint": "/kb_invoice",
        "http_method": "GET",
        "description": "Retrieve invoices from Bexio",
        "sync_interval_min": 60
      },
      {
        "name": "Fetch Payments",
        "interface_type": "inbound",
        "protocol": "rest",
        "endpoint": "/kb_payment",
        "http_method": "GET",
        "description": "Retrieve payment records",
        "sync_interval_min": 60
      }
    ]'::jsonb,
    TRUE,
    NULL,
    'https://docs.bexio.com/'
  ),
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000010',
    'Google Calendar',
    'google-calendar',
    'calendar',
    'https://www.googleapis.com/calendar/v3',
    'service_account',
    'google_service_account',
    '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb,
    '[
      {
        "name": "Fetch Events",
        "interface_type": "inbound",
        "protocol": "rest",
        "endpoint": "/calendars/{calendarId}/events",
        "http_method": "GET",
        "description": "Retrieve calendar events for appointment tracking",
        "sync_interval_min": 15
      }
    ]'::jsonb,
    TRUE,
    NULL,
    'https://developers.google.com/calendar/api'
  ),
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000010',
    'Leadnotes',
    'leadnotes',
    'lead_aggregation',
    'https://api.leadnotes.io/v1',
    'api_key',
    'leadnotes_api_key',
    '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb,
    '[
      {
        "name": "Fetch Leads",
        "interface_type": "inbound",
        "protocol": "rest",
        "endpoint": "/leads",
        "http_method": "GET",
        "description": "Ingest aggregated leads from Leadnotes",
        "sync_interval_min": 15
      }
    ]'::jsonb,
    TRUE,
    NULL,
    NULL
  )
ON CONFLICT DO NOTHING;


-- ====== 017_locale_preference.sql ======
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS locale_preference TEXT CHECK (locale_preference IN ('de','en','fr','it'));


-- ====== 018_compliance.sql ======
-- =============================================================================
-- Migration 018: Compliance architecture
-- Tables: compliance_rules, compliance_checks, compliance_documents, certifications
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. compliance_rules â€” master catalogue of rules
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
-- 2. compliance_checks â€” individual check instances
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
-- 3. compliance_documents â€” uploaded evidence / contracts
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
-- 4. certifications â€” certification roadmap
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
  'Standardvertragsklauseln fÃ¼r Drittlandtransfer',
  'Bei Anbindung eines Connectors mit Datenverarbeitung auÃŸerhalb der EU/CH mÃ¼ssen SCC abgeschlossen werden.',
  'connector_created',
  '{"third_country": true}',
  'SCC-Vertrag mit dem Auftragsverarbeiter abschlieÃŸen und als Dokument hochladen.',
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
  'AVV mit dem Anbieter abschlieÃŸen und als Dokument (Typ: avv) hochladen.',
  14,
  'critical',
  'Art. 28 DSGVO / Art. 9 DSG'
),
(
  'AUDIO_CONSENT',
  'Einwilligung fÃ¼r GesprÃ¤chsaufzeichnung',
  'Vor Aktivierung der 3CX-Aufzeichnung muss die Einwilligung der GesprÃ¤chsteilnehmer sichergestellt sein.',
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
  'Finanzdaten (Rechnungen, Zahlungen) mÃ¼ssen mindestens 10 Jahre aufbewahrt werden.',
  'scheduled',
  '{"schedule": "yearly"}',
  'JÃ¤hrliche PrÃ¼fung der Archivierung und LÃ¶schfristen fÃ¼r Finanzdaten.',
  90,
  'warning',
  'Art. 958f OR (CH) / Â§ 147 AO (DE)'
),
(
  'OAUTH_SECRET_ROTATION',
  'OAuth-Secret-Rotation',
  'OAuth-Client-Secrets mÃ¼ssen regelmÃ¤ÃŸig rotiert werden.',
  'secret_rotated',
  '{"secret_type": "oauth2_token"}',
  'Secret rotieren und neuen Token im Connector hinterlegen.',
  90,
  'warning',
  'Best Practice â€” OWASP Secret Management'
),
(
  'NEW_HOLDING_BASELINE',
  'Datenschutz-Grundausstattung fÃ¼r neues Holding',
  'Beim Erstellen eines Holdings mÃ¼ssen grundlegende Datenschutzdokumente vorhanden sein (TOM, VVT).',
  'holding_created',
  '{}',
  'TOM-Dokument und Verzeichnis der VerarbeitungstÃ¤tigkeiten (VVT) hochladen.',
  60,
  'critical',
  'Art. 30 DSGVO / Art. 12 DSG'
),
(
  'HIGH_RISK_DSFA',
  'Datenschutz-FolgenabschÃ¤tzung (DSFA)',
  'Bei Verarbeitung mit hohem Risiko (z.B. KI-Analyse von GesprÃ¤chen) ist eine DSFA erforderlich.',
  'manual',
  '{}',
  'DSFA durchfÃ¼hren und als Dokument (Typ: dsfa) hochladen.',
  90,
  'critical',
  'Art. 35 DSGVO / Art. 22 DSG'
)
ON CONFLICT (rule_code) DO NOTHING;


-- ====== 019_liquidity_runtime.sql ======
-- =============================================================================
-- Migration 019: Liquidity Planning & Interface Execution Engine
-- Tables: project_process_instances, liquidity_event_instances,
--         bank_upload_files, bank_transactions, interface_execution_log
-- Also: company_settings columns for liquidity thresholds
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. project_process_instances â€” runtime instance of a process per project
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.project_process_instances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id      UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  process_id      UUID NOT NULL REFERENCES public.process_definitions(id) ON DELETE CASCADE,
  process_version TEXT NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'completed', 'cancelled')),
  UNIQUE (project_id, process_id)
);

-- ---------------------------------------------------------------------------
-- 2. liquidity_event_instances â€” per-project liquidity plan/actual events
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.liquidity_event_instances (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id           UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id           UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  instance_id          UUID NOT NULL REFERENCES public.project_process_instances(id) ON DELETE CASCADE,
  project_id           UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  process_id           UUID NOT NULL REFERENCES public.process_definitions(id) ON DELETE CASCADE,
  step_id              UUID NOT NULL REFERENCES public.process_steps(id) ON DELETE CASCADE,
  process_step_id      TEXT NOT NULL,
  step_name            TEXT NOT NULL,
  marker_type          TEXT NOT NULL CHECK (marker_type IN ('trigger', 'event')),
  linked_instance_id   UUID REFERENCES public.liquidity_event_instances(id) ON DELETE SET NULL,
  direction            TEXT NOT NULL CHECK (direction IN ('income', 'expense')),
  plan_currency        TEXT NOT NULL DEFAULT 'CHF',
  plan_amount          NUMERIC(14,2),
  amount_type          TEXT NOT NULL DEFAULT 'fixed' CHECK (amount_type IN ('fixed', 'percentage')),
  plan_delay_days      INTEGER DEFAULT 0,
  trigger_activated_at TIMESTAMPTZ,
  plan_date            DATE,
  actual_date          DATE,
  actual_currency      TEXT,
  actual_amount        NUMERIC(14,2),
  fx_rate              NUMERIC(14,6),
  fx_rate_date         DATE,
  actual_source        TEXT CHECK (actual_source IS NULL OR actual_source IN ('bexio', 'bank_upload', 'manual', 'connector')),
  actual_source_ref    TEXT,
  matched_at           TIMESTAMPTZ,
  matched_by           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  amount_deviation     NUMERIC(14,2),
  date_deviation_days  INTEGER,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 3. bank_upload_files â€” uploaded bank statement files
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.bank_upload_files (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id        UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id        UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  filename          TEXT NOT NULL,
  file_format       TEXT NOT NULL CHECK (file_format IN ('camt053', 'mt940', 'csv')),
  storage_path      TEXT NOT NULL,
  period_from       DATE,
  period_to         DATE,
  transaction_count INTEGER,
  processed_at      TIMESTAMPTZ,
  matched_count     INTEGER NOT NULL DEFAULT 0,
  unmatched_count   INTEGER NOT NULL DEFAULT 0,
  uploaded_by       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 4. bank_transactions â€” parsed individual transactions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id        UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id        UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  upload_id         UUID NOT NULL REFERENCES public.bank_upload_files(id) ON DELETE CASCADE,
  transaction_date  DATE NOT NULL,
  value_date        DATE,
  amount            NUMERIC(14,2) NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'CHF',
  direction         TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
  reference         TEXT,
  counterparty_name TEXT,
  counterparty_iban TEXT,
  description       TEXT,
  matched_to        UUID REFERENCES public.liquidity_event_instances(id) ON DELETE SET NULL,
  match_confidence  NUMERIC(4,3),
  status            TEXT NOT NULL DEFAULT 'unmatched'
                      CHECK (status IN ('unmatched', 'matched', 'ignored'))
);

-- ---------------------------------------------------------------------------
-- 5. interface_execution_log â€” audit trail for interface executions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.interface_execution_log (
  id              BIGSERIAL PRIMARY KEY,
  holding_id      UUID,
  company_id      UUID,
  interface_id    UUID REFERENCES public.process_step_interfaces(id) ON DELETE SET NULL,
  step_id         UUID,
  process_id      UUID,
  executed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trigger         TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('success', 'error', 'timeout', 'skipped')),
  http_status     INTEGER,
  duration_ms     INTEGER,
  retry_count     INTEGER NOT NULL DEFAULT 0,
  error_message   TEXT,
  error_context   JSONB
);

-- ---------------------------------------------------------------------------
-- 6. company_settings â€” add liquidity threshold columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS min_liquidity_threshold NUMERIC(14,2) DEFAULT 10000;

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(14,2) DEFAULT 0;

-- =============================================================================
-- updated_at trigger for liquidity_event_instances
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_liquidity_event_instances_updated_at
  ON public.liquidity_event_instances;

CREATE TRIGGER trg_liquidity_event_instances_updated_at
  BEFORE UPDATE ON public.liquidity_event_instances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.project_process_instances  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liquidity_event_instances  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_upload_files          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transactions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interface_execution_log    ENABLE ROW LEVEL SECURITY;

-- ---- Three-tier RLS for project_process_instances, liquidity_event_instances,
--      bank_upload_files, bank_transactions ----

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'project_process_instances',
    'liquidity_event_instances',
    'bank_upload_files',
    'bank_transactions'
  ] LOOP
    -- Enura admin: full access
    EXECUTE format(
      'CREATE POLICY "enura_admin_%s" ON public.%I FOR ALL USING (public.is_enura_admin())',
      tbl, tbl
    );
    -- Holding admin: full access within own holding
    EXECUTE format(
      'CREATE POLICY "holding_admin_%s" ON public.%I FOR ALL USING (holding_id = public.current_holding_id() AND public.is_holding_admin()) WITH CHECK (holding_id = public.current_holding_id() AND public.is_holding_admin())',
      tbl, tbl
    );
    -- Company user: read access within own company
    EXECUTE format(
      'CREATE POLICY "company_user_%s" ON public.%I FOR SELECT USING (company_id = public.current_company_id())',
      tbl, tbl
    );
    -- Service role: full access
    EXECUTE format(
      'CREATE POLICY "service_%s" ON public.%I FOR ALL USING (current_setting(''role'') = ''service_role'') WITH CHECK (current_setting(''role'') = ''service_role'')',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ---- interface_execution_log: holding admin read + enura admin all + append-only ----

CREATE POLICY "enura_admin_interface_execution_log"
  ON public.interface_execution_log FOR ALL
  USING (public.is_enura_admin());

CREATE POLICY "holding_admin_interface_execution_log"
  ON public.interface_execution_log FOR SELECT
  USING (holding_id = public.current_holding_id() AND public.is_holding_admin());

CREATE POLICY "interface_execution_log_insert"
  ON public.interface_execution_log FOR INSERT
  WITH CHECK (true);

CREATE POLICY "service_interface_execution_log"
  ON public.interface_execution_log FOR ALL
  USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');

-- =============================================================================
-- INDEXES
-- =============================================================================

-- project_process_instances
CREATE INDEX IF NOT EXISTS idx_ppi_company_status
  ON public.project_process_instances (company_id, status);

CREATE INDEX IF NOT EXISTS idx_ppi_project
  ON public.project_process_instances (project_id);

-- liquidity_event_instances
CREATE INDEX IF NOT EXISTS idx_lei_company_plan_date
  ON public.liquidity_event_instances (company_id, plan_date);

CREATE INDEX IF NOT EXISTS idx_lei_project
  ON public.liquidity_event_instances (project_id);

CREATE INDEX IF NOT EXISTS idx_lei_instance
  ON public.liquidity_event_instances (instance_id);

CREATE INDEX IF NOT EXISTS idx_lei_overdue
  ON public.liquidity_event_instances (company_id, plan_date)
  WHERE actual_date IS NULL;

-- bank_upload_files
CREATE INDEX IF NOT EXISTS idx_buf_company_uploaded
  ON public.bank_upload_files (company_id, uploaded_at);

-- bank_transactions
CREATE INDEX IF NOT EXISTS idx_bt_company_date
  ON public.bank_transactions (company_id, transaction_date);

CREATE INDEX IF NOT EXISTS idx_bt_status
  ON public.bank_transactions (company_id, status)
  WHERE status = 'unmatched';

CREATE INDEX IF NOT EXISTS idx_bt_upload
  ON public.bank_transactions (upload_id);

-- interface_execution_log
CREATE INDEX IF NOT EXISTS idx_iel_interface
  ON public.interface_execution_log (interface_id, executed_at);

CREATE INDEX IF NOT EXISTS idx_iel_company_date
  ON public.interface_execution_log (company_id, executed_at);

CREATE INDEX IF NOT EXISTS idx_iel_status
  ON public.interface_execution_log (status)
  WHERE status = 'error';


-- ====== 020_platform_admin.sql ======
-- =============================================================================
-- Migration 020: Platform Admin â€” Holding Onboarding & White-Label
-- Phase 11: Subscription management, onboarding wizard, user invitations,
--           and platform-wide metrics for the Enura admin dashboard.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. holding_subscriptions
-- =============================================================================

CREATE TABLE IF NOT EXISTS holding_subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id    UUID NOT NULL UNIQUE REFERENCES holdings(id) ON DELETE CASCADE,
  plan          TEXT NOT NULL DEFAULT 'professional'
                  CHECK (plan IN ('starter', 'professional', 'scale', 'enterprise')),
  company_plan  TEXT NOT NULL DEFAULT 'professional'
                  CHECK (company_plan IN ('starter', 'professional', 'scale', 'enterprise')),
  billing_cycle TEXT NOT NULL DEFAULT 'monthly'
                  CHECK (billing_cycle IN ('monthly', 'annual')),
  ai_calls_enabled        BOOLEAN NOT NULL DEFAULT TRUE,
  process_builder_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  liquidity_enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  max_companies           INTEGER NOT NULL DEFAULT 10,
  max_users_per_company   INTEGER NOT NULL DEFAULT 30,
  trial_ends_at           DATE,
  activated_at            TIMESTAMPTZ,
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE holding_subscriptions IS 'One subscription per holding â€” controls plan features, limits, and billing.';

-- =============================================================================
-- 2. holding_onboarding
-- =============================================================================

CREATE TABLE IF NOT EXISTS holding_onboarding (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id      UUID NOT NULL UNIQUE REFERENCES holdings(id) ON DELETE CASCADE,
  current_step    INTEGER NOT NULL DEFAULT 1,
  completed_steps INTEGER[] NOT NULL DEFAULT '{}',
  wizard_data     JSONB NOT NULL DEFAULT '{}',
  is_complete     BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE holding_onboarding IS 'Tracks onboarding wizard progress for each holding.';

-- =============================================================================
-- 3. user_invitations
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id  UUID NOT NULL REFERENCES holdings(id) ON DELETE CASCADE,
  company_id  UUID REFERENCES companies(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role_name   TEXT NOT NULL,
  invited_by  UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  token       TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES profiles(id),
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE user_invitations IS 'Invitation tokens for onboarding new users into a holding or company.';

-- Partial index: only non-accepted, non-revoked tokens are looked up
CREATE INDEX idx_user_invitations_token_active
  ON user_invitations (token)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

-- Fast lookup of invitations by email within a holding
CREATE INDEX idx_user_invitations_email_holding
  ON user_invitations (email, holding_id);

-- =============================================================================
-- 4. platform_metrics
-- =============================================================================

CREATE TABLE IF NOT EXISTS platform_metrics (
  id                BIGSERIAL PRIMARY KEY,
  measured_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_holdings    INTEGER NOT NULL DEFAULT 0,
  active_holdings   INTEGER NOT NULL DEFAULT 0,
  total_companies   INTEGER NOT NULL DEFAULT 0,
  total_users       INTEGER NOT NULL DEFAULT 0,
  ai_calls_24h     INTEGER NOT NULL DEFAULT 0,
  deployments_24h   INTEGER NOT NULL DEFAULT 0
);

COMMENT ON TABLE platform_metrics IS 'Time-series snapshots of platform-wide metrics for the Enura admin dashboard.';

CREATE INDEX idx_platform_metrics_measured_at
  ON platform_metrics (measured_at DESC);

-- =============================================================================
-- 5. Trigger: auto-create holding_subscriptions on holdings INSERT
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_auto_create_holding_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO holding_subscriptions (holding_id)
  VALUES (NEW.id)
  ON CONFLICT (holding_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_holding_subscription ON holdings;
CREATE TRIGGER trg_auto_create_holding_subscription
  AFTER INSERT ON holdings
  FOR EACH ROW
  EXECUTE FUNCTION fn_auto_create_holding_subscription();

-- =============================================================================
-- 6. updated_at triggers
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_holding_subscriptions_updated_at
  BEFORE UPDATE ON holding_subscriptions
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_holding_onboarding_updated_at
  BEFORE UPDATE ON holding_onboarding
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- =============================================================================
-- 7. Row-Level Security
-- =============================================================================

-- ---- holding_subscriptions ----
ALTER TABLE holding_subscriptions ENABLE ROW LEVEL SECURITY;

-- Enura admins: full access
CREATE POLICY holding_subscriptions_enura_all
  ON holding_subscriptions
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM enura_admins WHERE profile_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM enura_admins WHERE profile_id = auth.uid())
  );

-- Holding admins: read own
CREATE POLICY holding_subscriptions_holding_read
  ON holding_subscriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM holding_admins_v2
      WHERE holding_admins_v2.holding_id = holding_subscriptions.holding_id
        AND holding_admins_v2.profile_id = auth.uid()
    )
  );

-- ---- holding_onboarding ----
ALTER TABLE holding_onboarding ENABLE ROW LEVEL SECURITY;

-- Enura admins: full access
CREATE POLICY holding_onboarding_enura_all
  ON holding_onboarding
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM enura_admins WHERE profile_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM enura_admins WHERE profile_id = auth.uid())
  );

-- Holding admins: full access to own
CREATE POLICY holding_onboarding_holding_all
  ON holding_onboarding
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM holding_admins_v2
      WHERE holding_admins_v2.holding_id = holding_onboarding.holding_id
        AND holding_admins_v2.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM holding_admins_v2
      WHERE holding_admins_v2.holding_id = holding_onboarding.holding_id
        AND holding_admins_v2.profile_id = auth.uid()
    )
  );

-- ---- user_invitations ----
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;

-- Enura admins: full access
CREATE POLICY user_invitations_enura_all
  ON user_invitations
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM enura_admins WHERE profile_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM enura_admins WHERE profile_id = auth.uid())
  );

-- Holding admins: full access to own holding's invitations
CREATE POLICY user_invitations_holding_all
  ON user_invitations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM holding_admins_v2
      WHERE holding_admins_v2.holding_id = user_invitations.holding_id
        AND holding_admins_v2.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM holding_admins_v2
      WHERE holding_admins_v2.holding_id = user_invitations.holding_id
        AND holding_admins_v2.profile_id = auth.uid()
    )
  );

-- Public (anon/authenticated): read a single invitation by valid, unexpired token
CREATE POLICY user_invitations_token_read
  ON user_invitations
  FOR SELECT
  USING (
    accepted_at IS NULL
    AND revoked_at IS NULL
    AND expires_at > now()
  );

-- ---- platform_metrics ----
ALTER TABLE platform_metrics ENABLE ROW LEVEL SECURITY;

-- Enura admins only
CREATE POLICY platform_metrics_enura_all
  ON platform_metrics
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM enura_admins WHERE profile_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM enura_admins WHERE profile_id = auth.uid())
  );

COMMIT;


-- ====== 021_manual.sql ======
-- =============================================================================
-- Migration 021: Manual / Help System
-- Phase 13: Contextual help snippets, guided tours, help feedback.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. help_snippets â€” contextual tooltips / inline help per locale
-- =============================================================================

CREATE TABLE IF NOT EXISTS help_snippets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_key  TEXT NOT NULL,
  locale        TEXT NOT NULL CHECK (locale IN ('de', 'en', 'fr', 'it')),
  title         TEXT NOT NULL,
  content       TEXT NOT NULL,
  article_slug  TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  UNIQUE (location_key, locale)
);

CREATE INDEX idx_help_snippets_location ON help_snippets(location_key);

-- =============================================================================
-- 2. user_tour_progress â€” tracks onboarding / guided tour completion
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_tour_progress (
  profile_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tour_id       TEXT NOT NULL,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ,
  last_step     INTEGER NOT NULL DEFAULT 0,
  skipped       BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (profile_id, tour_id)
);

-- =============================================================================
-- 3. help_feedback â€” user feedback on help articles
-- =============================================================================

CREATE TABLE IF NOT EXISTS help_feedback (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_slug  TEXT NOT NULL,
  profile_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  locale        TEXT NOT NULL CHECK (locale IN ('de', 'en', 'fr', 'it')),
  helpful       BOOLEAN NOT NULL,
  comment       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_help_feedback_article ON help_feedback(article_slug);

-- =============================================================================
-- 4. RLS Policies
-- =============================================================================

ALTER TABLE help_snippets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tour_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE help_feedback ENABLE ROW LEVEL SECURITY;

-- help_snippets: readable by all authenticated, writable by enura admins
CREATE POLICY "help_snippets_select_authenticated"
  ON help_snippets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "help_snippets_insert_enura_admin"
  ON help_snippets FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM enura_admins WHERE profile_id = auth.uid())
  );

CREATE POLICY "help_snippets_update_enura_admin"
  ON help_snippets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM enura_admins WHERE profile_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM enura_admins WHERE profile_id = auth.uid())
  );

CREATE POLICY "help_snippets_delete_enura_admin"
  ON help_snippets FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM enura_admins WHERE profile_id = auth.uid())
  );

-- user_tour_progress: users manage own rows
CREATE POLICY "tour_progress_select_own"
  ON user_tour_progress FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "tour_progress_insert_own"
  ON user_tour_progress FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "tour_progress_update_own"
  ON user_tour_progress FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "tour_progress_delete_own"
  ON user_tour_progress FOR DELETE
  TO authenticated
  USING (profile_id = auth.uid());

-- help_feedback: users write own, enura admins read all
CREATE POLICY "help_feedback_select_own"
  ON help_feedback FOR SELECT
  TO authenticated
  USING (
    profile_id = auth.uid()
    OR EXISTS (SELECT 1 FROM enura_admins WHERE profile_id = auth.uid())
  );

CREATE POLICY "help_feedback_insert_own"
  ON help_feedback FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

-- =============================================================================
-- 5. Seed ~15 German contextual snippets
-- =============================================================================

INSERT INTO help_snippets (id, location_key, locale, title, content, article_slug)
VALUES
  (gen_random_uuid(), 'settings.secrets.api_key', 'de',
   'API-SchlÃ¼ssel',
   'Der API-SchlÃ¼ssel authentifiziert die Verbindung zu externen Diensten. Bewahren Sie ihn sicher auf und teilen Sie ihn nie in Ã¶ffentlichen KanÃ¤len. Nach dem Speichern wird der SchlÃ¼ssel verschlÃ¼sselt abgelegt und ist nicht mehr im Klartext abrufbar.',
   'secrets-management'),

  (gen_random_uuid(), 'settings.secrets.oauth_token', 'de',
   'OAuth-Token',
   'OAuth-Tokens ermÃ¶glichen den Zugriff auf Drittanbieter-APIs im Namen Ihres Unternehmens. Tokens laufen regelmÃ¤ssig ab und werden automatisch erneuert. Sollte die Erneuerung fehlschlagen, mÃ¼ssen Sie die Verbindung erneut autorisieren.',
   'secrets-management'),

  (gen_random_uuid(), 'settings.secrets.encryption', 'de',
   'VerschlÃ¼sselung von Geheimnissen',
   'Alle Credentials werden mit AES-256-GCM verschlÃ¼sselt in der Datenbank gespeichert. Der VerschlÃ¼sselungsschlÃ¼ssel liegt in Supabase Vault und ist fÃ¼r die Applikationsebene nicht einsehbar.',
   'secrets-management'),

  (gen_random_uuid(), 'process_builder.overview', 'de',
   'Prozess-Builder Ãœbersicht',
   'Der Prozess-Builder ermÃ¶glicht die visuelle Definition von GeschÃ¤ftsprozessen. Erstellen Sie Schritte, definieren Sie Datenquellen und verknÃ¼pfen Sie Schnittstellen. Jeder Prozess durchlÃ¤uft Versionierung und kann pro Unternehmen bereitgestellt werden.',
   'process-builder'),

  (gen_random_uuid(), 'process_builder.step_config', 'de',
   'Schritt-Konfiguration',
   'Jeder Prozessschritt kann Datenquellen, Schnittstellen und LiquiditÃ¤tsereignisse enthalten. Die Reihenfolge bestimmt den Ablauf. Verwenden Sie die Drag-and-Drop-Funktion, um Schritte neu zu ordnen.',
   'process-builder'),

  (gen_random_uuid(), 'process_builder.versioning', 'de',
   'Prozess-Versionierung',
   'Ã„nderungen an einem Prozess erstellen automatisch eine neue Version. Nur verÃ¶ffentlichte Versionen kÃ¶nnen bereitgestellt werden. Ã„ltere Versionen bleiben als Referenz erhalten.',
   'process-builder'),

  (gen_random_uuid(), 'process_builder.deployment', 'de',
   'Prozess-Bereitstellung',
   'Nach der VerÃ¶ffentlichung kÃ¶nnen Sie einen Prozess fÃ¼r einzelne Unternehmen bereitstellen. Pro Unternehmen ist nur eine aktive Bereitstellung mÃ¶glich. Bei Problemen kÃ¶nnen Sie auf eine frÃ¼here Version zurÃ¼ckrollen.',
   'process-builder'),

  (gen_random_uuid(), 'liquidity.forecast', 'de',
   'LiquiditÃ¤tsprognose',
   'Die 30/60/90-Tage-Prognose berechnet sich aus offenen Rechnungen, geplanten Zahlungen und historischen Cashflow-Daten. Die Warngrenze wird pro Unternehmen konfiguriert â€” unterschreitet die Prognose diesen Wert, wird eine Benachrichtigung ausgelÃ¶st.',
   'liquidity-forecast'),

  (gen_random_uuid(), 'liquidity.cashflow_upload', 'de',
   'Cashflow-Upload',
   'Laden Sie monatliche Cashflow-Daten als Excel-Datei hoch. Die Datei muss die Spalten Datum, Kategorie, Betrag und Beschreibung enthalten. UngÃ¼ltige Zeilen werden Ã¼bersprungen und im Fehlerbericht aufgefÃ¼hrt.',
   'cashflow-upload'),

  (gen_random_uuid(), 'liquidity.bank_transactions', 'de',
   'Banktransaktionen',
   'Importierte Banktransaktionen werden automatisch mit offenen Rechnungen abgeglichen. Bei Mehrdeutigkeiten wird ein manueller Abgleich vorgeschlagen. Die Zuordnung beeinflusst direkt die LiquiditÃ¤tsberechnung.',
   'bank-transactions'),

  (gen_random_uuid(), 'permissions.role_overview', 'de',
   'Rollen-Ãœbersicht',
   'Jede Rolle definiert, welche Module und Aktionen ein Benutzer ausfÃ¼hren darf. Rollen werden pro Unternehmen zugewiesen. Ein Benutzer kann mehrere Rollen haben â€” die Berechtigungen werden vereinigt (Union).',
   'role-permissions'),

  (gen_random_uuid(), 'permissions.module_access', 'de',
   'Modul-Zugriff',
   'Berechtigungen folgen dem Schema module:{modul}:{aktion}. Aktionen sind: read, write, export, admin. Ohne explizite Berechtigung ist der Zugriff standardmÃ¤ssig verweigert (Deny by Default).',
   'role-permissions'),

  (gen_random_uuid(), 'permissions.holding_admin', 'de',
   'Holding-Administrator',
   'Holding-Administratoren haben Zugriff auf alle Unternehmen der Holding. Sie sind keine Mandantenbenutzer und besitzen keine company_id. Ihre Aktionen werden im Audit-Log protokolliert.',
   'role-permissions'),

  (gen_random_uuid(), 'connector.health_status', 'de',
   'Connector-Status',
   'Der Status zeigt den Zustand jeder Datenverbindung. GrÃ¼n = letzte Synchronisation erfolgreich. Gelb = Warnung (z. B. Teilfehler). Rot = Fehler nach 3 fehlgeschlagenen Versuchen. PrÃ¼fen Sie die Fehlermeldung und die Zugangsdaten.',
   'connector-health'),

  (gen_random_uuid(), 'kanban.phase_stall', 'de',
   'Phasen-Stagnation',
   'Projekte, die lÃ¤nger als der konfigurierte Schwellenwert in einer Phase verweilen, werden als "stagnierend" markiert. Der Schwellenwert wird pro Phase in den Phasendefinitionen festgelegt und kann jederzeit angepasst werden.',
   'kanban-phases')

ON CONFLICT (location_key, locale) DO UPDATE SET
  title        = EXCLUDED.title,
  content      = EXCLUDED.content,
  article_slug = EXCLUDED.article_slug,
  updated_at   = now();

COMMIT;


-- ====== 022_corporate_design.sql ======
-- Add extended tokens and custom CSS support to company_branding
ALTER TABLE public.company_branding
  ADD COLUMN IF NOT EXISTS extended_tokens JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS custom_css_path TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS custom_css_updated_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS custom_css_uploaded_by UUID REFERENCES public.profiles(id) DEFAULT NULL;

-- Index for quick lookup of companies with custom CSS
CREATE INDEX IF NOT EXISTS idx_company_branding_custom_css
  ON public.company_branding (company_id) WHERE custom_css_path IS NOT NULL;


-- ====== 023_fix_seed_roles_trigger.sql ======
-- Fix: seed_company_roles() trigger uses column "name" but the actual column is "key"
-- Also fix init_company_branding() and init_company_settings() if needed

CREATE OR REPLACE FUNCTION public.seed_company_roles()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_super_role_id UUID;
BEGIN
  -- Insert roles using "key" column (not "name" which doesn't exist)
  INSERT INTO public.roles (company_id, holding_id, key, label, is_super, is_system)
  VALUES (NEW.id, NEW.holding_id, 'super_user', 'Super User', TRUE, TRUE)
  RETURNING id INTO v_super_role_id;

  INSERT INTO public.roles (company_id, holding_id, key, label, is_system) VALUES
    (NEW.id, NEW.holding_id, 'geschaeftsfuehrung', 'GeschÃ¤ftsfÃ¼hrung',    TRUE),
    (NEW.id, NEW.holding_id, 'teamleiter',         'Teamleiter',           TRUE),
    (NEW.id, NEW.holding_id, 'setter',             'Setter',               TRUE),
    (NEW.id, NEW.holding_id, 'berater',            'Berater',              TRUE),
    (NEW.id, NEW.holding_id, 'innendienst',        'Innendienst',          TRUE),
    (NEW.id, NEW.holding_id, 'bau',                'Bau / Montage',        TRUE),
    (NEW.id, NEW.holding_id, 'buchhaltung',        'Buchhaltung',          TRUE),
    (NEW.id, NEW.holding_id, 'leadkontrolle',      'Leadkontrolle',        TRUE);

  -- Assign all permissions to super_user
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_super_role_id, id FROM public.permissions;

  RETURN NEW;
END;
$$;


-- ====== 024_fix_seed_roles_columns.sql ======
-- Fix: seed_company_roles() uses "is_super" but column is "is_system"
-- Also the super_user role needs is_system=TRUE (there is no is_super column)

CREATE OR REPLACE FUNCTION public.seed_company_roles()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_super_role_id UUID;
BEGIN
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'super_user', 'Super User', TRUE)
  RETURNING id INTO v_super_role_id;

  INSERT INTO public.roles (company_id, holding_id, key, label, is_system) VALUES
    (NEW.id, NEW.holding_id, 'geschaeftsfuehrung', 'GeschÃ¤ftsfÃ¼hrung', TRUE),
    (NEW.id, NEW.holding_id, 'teamleiter',         'Teamleiter',          TRUE),
    (NEW.id, NEW.holding_id, 'setter',             'Setter',              TRUE),
    (NEW.id, NEW.holding_id, 'berater',            'Berater',             TRUE),
    (NEW.id, NEW.holding_id, 'innendienst',        'Innendienst',         TRUE),
    (NEW.id, NEW.holding_id, 'bau',                'Bau / Montage',       TRUE),
    (NEW.id, NEW.holding_id, 'buchhaltung',        'Buchhaltung',         TRUE),
    (NEW.id, NEW.holding_id, 'leadkontrolle',      'Leadkontrolle',       TRUE);

  -- Assign all permissions to super_user role
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_super_role_id, id FROM public.permissions;

  RETURN NEW;
END;
$$;


-- ====== 025_fix_process_categories.sql ======
-- 025_fix_process_categories.sql
-- Align process_templates and process_definitions category CHECK constraints
-- to the German values used throughout the application code.

-- process_templates: drop old CHECK and add new one
ALTER TABLE public.process_templates
  DROP CONSTRAINT IF EXISTS process_templates_category_check;

ALTER TABLE public.process_templates
  ADD CONSTRAINT process_templates_category_check
  CHECK (category IN ('verkauf','planung','abwicklung','betrieb','sonstige'));

-- process_definitions: drop old CHECK and add new one
ALTER TABLE public.process_definitions
  DROP CONSTRAINT IF EXISTS process_definitions_category_check;

ALTER TABLE public.process_definitions
  ADD CONSTRAINT process_definitions_category_check
  CHECK (category IN ('verkauf','planung','abwicklung','betrieb','sonstige'));


-- ====== 026_fix_role_permissions.sql ======
-- 026_fix_role_permissions.sql
-- Fix: seed_company_roles() only assigned permissions to super_user.
-- All other roles (setter, berater, etc.) had zero permissions, causing
-- users to see only the Dashboard in the sidebar.
--
-- This migration:
-- 1. Assigns correct permissions to ALL existing roles for all companies
-- 2. Updates the trigger to do the same for future companies

-- ============================================================================
-- 1. Back-fill permissions for existing roles
-- ============================================================================

DO $$
DECLARE
  v_role RECORD;
  v_perm_id UUID;
BEGIN
  -- geschaeftsfuehrung: ALL module:*:read permissions + reports
  FOR v_role IN SELECT id FROM public.roles WHERE key = 'geschaeftsfuehrung'
  LOOP
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_role.id, p.id FROM public.permissions p
    WHERE p.key LIKE 'module:%:read'
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END LOOP;

  -- teamleiter: setter, berater, leads read + reports read
  FOR v_role IN SELECT id FROM public.roles WHERE key = 'teamleiter'
  LOOP
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_role.id, p.id FROM public.permissions p
    WHERE p.key IN ('module:setter:read', 'module:berater:read', 'module:leads:read', 'module:reports:read')
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END LOOP;

  -- setter: setter read
  FOR v_role IN SELECT id FROM public.roles WHERE key = 'setter'
  LOOP
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_role.id, p.id FROM public.permissions p
    WHERE p.key IN ('module:setter:read')
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END LOOP;

  -- berater: berater read
  FOR v_role IN SELECT id FROM public.roles WHERE key = 'berater'
  LOOP
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_role.id, p.id FROM public.permissions p
    WHERE p.key IN ('module:berater:read')
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END LOOP;

  -- innendienst: innendienst read + write
  FOR v_role IN SELECT id FROM public.roles WHERE key = 'innendienst'
  LOOP
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_role.id, p.id FROM public.permissions p
    WHERE p.key IN ('module:innendienst:read', 'module:innendienst:write')
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END LOOP;

  -- bau: bau read + write
  FOR v_role IN SELECT id FROM public.roles WHERE key = 'bau'
  LOOP
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_role.id, p.id FROM public.permissions p
    WHERE p.key IN ('module:bau:read', 'module:bau:write')
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END LOOP;

  -- buchhaltung: finance read + write
  FOR v_role IN SELECT id FROM public.roles WHERE key = 'buchhaltung'
  LOOP
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_role.id, p.id FROM public.permissions p
    WHERE p.key IN ('module:finance:read', 'module:finance:write')
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END LOOP;

  -- leadkontrolle: leads read + write
  FOR v_role IN SELECT id FROM public.roles WHERE key = 'leadkontrolle'
  LOOP
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_role.id, p.id FROM public.permissions p
    WHERE p.key IN ('module:leads:read', 'module:leads:write')
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END LOOP;
END $$;

-- ============================================================================
-- 2. Update seed_company_roles trigger to assign per-role permissions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.seed_company_roles()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_role_id UUID;
BEGIN
  -- Create super_user role and assign ALL permissions
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'super_user', 'Super User', TRUE)
  RETURNING id INTO v_role_id;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions;

  -- geschaeftsfuehrung: all read permissions
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'geschaeftsfuehrung', 'GeschÃ¤ftsfÃ¼hrung', TRUE)
  RETURNING id INTO v_role_id;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE key LIKE 'module:%:read'
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- teamleiter: setter, berater, leads, reports read
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'teamleiter', 'Teamleiter', TRUE)
  RETURNING id INTO v_role_id;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions
  WHERE key IN ('module:setter:read', 'module:berater:read', 'module:leads:read', 'module:reports:read')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- setter: setter read
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'setter', 'Setter', TRUE)
  RETURNING id INTO v_role_id;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE key = 'module:setter:read'
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- berater: berater read
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'berater', 'Berater', TRUE)
  RETURNING id INTO v_role_id;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE key = 'module:berater:read'
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- innendienst: innendienst read + write
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'innendienst', 'Innendienst', TRUE)
  RETURNING id INTO v_role_id;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE key IN ('module:innendienst:read', 'module:innendienst:write')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- bau: bau read + write
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'bau', 'Bau / Montage', TRUE)
  RETURNING id INTO v_role_id;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE key IN ('module:bau:read', 'module:bau:write')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- buchhaltung: finance read + write
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'buchhaltung', 'Buchhaltung', TRUE)
  RETURNING id INTO v_role_id;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE key IN ('module:finance:read', 'module:finance:write')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- leadkontrolle: leads read + write
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'leadkontrolle', 'Leadkontrolle', TRUE)
  RETURNING id INTO v_role_id;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE key IN ('module:leads:read', 'module:leads:write')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  RETURN NEW;
END;
$$;


-- ====== 027_finanzplanung_licensing.sql ======
-- 027_finanzplanung_licensing.sql
-- Module licensing: company_feature_flags table + helper functions

BEGIN;

-- 1. Extend holding_subscriptions with Finanzplanung columns
ALTER TABLE public.holding_subscriptions
  ADD COLUMN IF NOT EXISTS finanzplanung_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS finanzplanung_activated_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finanzplanung_notes         TEXT;

-- 2. Company-level feature flags
CREATE TABLE IF NOT EXISTS public.company_feature_flags (
  company_id                UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  holding_id                UUID NOT NULL REFERENCES public.holdings(id),
  finanzplanung_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  finanzplanung_activated_at TIMESTAMPTZ,
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by                UUID REFERENCES public.profiles(id)
);

-- Auto-create flag row when a company is inserted
CREATE OR REPLACE FUNCTION public.init_company_feature_flags()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.company_feature_flags (company_id, holding_id)
  VALUES (NEW.id, NEW.holding_id)
  ON CONFLICT (company_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_init_company_feature_flags ON public.companies;
CREATE TRIGGER trg_init_company_feature_flags
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.init_company_feature_flags();

-- Backfill for existing companies
INSERT INTO public.company_feature_flags (company_id, holding_id)
SELECT id, holding_id FROM public.companies
ON CONFLICT (company_id) DO NOTHING;

-- 3. Helper functions

CREATE OR REPLACE FUNCTION public.holding_has_finanzplanung()
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (SELECT finanzplanung_enabled
     FROM public.holding_subscriptions
     WHERE holding_id = public.current_holding_id()),
    FALSE
  );
$$;

CREATE OR REPLACE FUNCTION public.company_has_finanzplanung()
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (SELECT cff.finanzplanung_enabled
     FROM public.company_feature_flags cff
     WHERE cff.company_id = public.current_company_id()),
    FALSE
  );
$$;

CREATE OR REPLACE FUNCTION public.finanzplanung_active()
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT public.holding_has_finanzplanung()
     AND public.company_has_finanzplanung();
$$;

-- 4. RLS
ALTER TABLE public.company_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "flags_enura" ON public.company_feature_flags FOR ALL
  USING (public.is_enura_admin());
CREATE POLICY "flags_holding_admin" ON public.company_feature_flags FOR ALL
  USING (holding_id = public.current_holding_id() AND public.is_holding_admin());
CREATE POLICY "flags_company_read" ON public.company_feature_flags FOR SELECT
  USING (company_id = public.current_company_id());

COMMIT;


-- ====== 028_finanzplanung_roles.sql ======
-- 028_finanzplanung_roles.sql
-- Four new Finanzplanung roles + permissions

BEGIN;

-- 1. Add Finanzplanung permissions (no 'module' column â€” key encodes it)
INSERT INTO public.permissions (key, label, description) VALUES
  ('module:finanzplanung:read',            'Finanzplanung lesen',              'Finanzplanungsmodul anzeigen'),
  ('module:finanzplanung:validate',        'Rechnungen prÃ¼fen',                'Eingangsrechnungen formal und inhaltlich prÃ¼fen'),
  ('module:finanzplanung:approve_invoice', 'Rechnungen genehmigen',            'Rechnungen technisch genehmigen'),
  ('module:finanzplanung:plan_cashout',    'ZahlungsausgÃ¤nge planen',          'ZahlungslÃ¤ufe erstellen und planen'),
  ('module:finanzplanung:approve_payment', 'ZahlungslÃ¤ufe genehmigen',         'ZahlungslÃ¤ufe final genehmigen'),
  ('module:finanzplanung:export_payment',  'Zahlungsdateien exportieren',      'Pain.001 / CSV Zahlungsdateien erzeugen'),
  ('module:finanzplanung:manage_suppliers','Lieferanten verwalten',            'Lieferanten-Stammdaten anlegen und bearbeiten')
ON CONFLICT (key) DO NOTHING;

-- 2. Seed four new roles into every existing company
DO $$
DECLARE
  v_company RECORD;
BEGIN
  FOR v_company IN SELECT id, holding_id FROM public.companies LOOP
    INSERT INTO public.roles (company_id, holding_id, key, label, is_system) VALUES
      (v_company.id, v_company.holding_id, 'validator',          'Rechnungspruefer',         TRUE),
      (v_company.id, v_company.holding_id, 'invoice_approver',   'Rechnungsgenehmiger',      TRUE),
      (v_company.id, v_company.holding_id, 'cashout_planner',    'Cash-out-Planer',          TRUE),
      (v_company.id, v_company.holding_id, 'financial_approver', 'Finanzieller Genehmiger',  TRUE)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- 3. Assign permissions to new roles (for all existing companies)
DO $$
DECLARE
  v_role RECORD;
BEGIN
  -- validator: read + validate
  FOR v_role IN SELECT id FROM public.roles WHERE key = 'validator' LOOP
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_role.id, p.id FROM public.permissions p
    WHERE p.key IN ('module:finanzplanung:read', 'module:finanzplanung:validate')
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END LOOP;

  -- invoice_approver: read + approve_invoice
  FOR v_role IN SELECT id FROM public.roles WHERE key = 'invoice_approver' LOOP
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_role.id, p.id FROM public.permissions p
    WHERE p.key IN ('module:finanzplanung:read', 'module:finanzplanung:approve_invoice')
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END LOOP;

  -- cashout_planner: read + plan_cashout + export_payment + manage_suppliers
  FOR v_role IN SELECT id FROM public.roles WHERE key = 'cashout_planner' LOOP
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_role.id, p.id FROM public.permissions p
    WHERE p.key IN (
      'module:finanzplanung:read',
      'module:finanzplanung:plan_cashout',
      'module:finanzplanung:export_payment',
      'module:finanzplanung:manage_suppliers'
    )
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END LOOP;

  -- financial_approver: read + approve_payment
  FOR v_role IN SELECT id FROM public.roles WHERE key = 'financial_approver' LOOP
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_role.id, p.id FROM public.permissions p
    WHERE p.key IN ('module:finanzplanung:read', 'module:finanzplanung:approve_payment')
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END LOOP;

  -- super_user: give all finanzplanung permissions to existing super_user roles
  FOR v_role IN SELECT id FROM public.roles WHERE key = 'super_user' LOOP
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_role.id, p.id FROM public.permissions p
    WHERE p.key LIKE 'module:finanzplanung:%'
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END LOOP;
END $$;

-- 4. Update seed_company_roles trigger to include new roles for future companies
CREATE OR REPLACE FUNCTION public.seed_company_roles()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_role_id UUID;
BEGIN
  -- super_user: ALL permissions
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'super_user', 'Super User', TRUE)
  RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions;

  -- geschaeftsfuehrung: all read permissions
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'geschaeftsfuehrung', 'GeschÃ¤ftsfÃ¼hrung', TRUE)
  RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE key LIKE 'module:%:read'
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- teamleiter
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'teamleiter', 'Teamleiter', TRUE)
  RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions
  WHERE key IN ('module:setter:read', 'module:berater:read', 'module:leads:read', 'module:reports:read')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- setter
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'setter', 'Setter', TRUE)
  RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE key = 'module:setter:read'
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- berater
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'berater', 'Berater', TRUE)
  RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE key = 'module:berater:read'
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- innendienst
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'innendienst', 'Innendienst', TRUE)
  RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE key IN ('module:innendienst:read', 'module:innendienst:write')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- bau
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'bau', 'Bau / Montage', TRUE)
  RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE key IN ('module:bau:read', 'module:bau:write')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- buchhaltung
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'buchhaltung', 'Buchhaltung', TRUE)
  RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE key IN ('module:finance:read', 'module:finance:write')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- leadkontrolle
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'leadkontrolle', 'Leadkontrolle', TRUE)
  RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE key IN ('module:leads:read', 'module:leads:write')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- Finanzplanung roles
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'validator', 'Rechnungspruefer', TRUE)
  RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions
  WHERE key IN ('module:finanzplanung:read', 'module:finanzplanung:validate')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'invoice_approver', 'Rechnungsgenehmiger', TRUE)
  RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions
  WHERE key IN ('module:finanzplanung:read', 'module:finanzplanung:approve_invoice')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'cashout_planner', 'Cash-out-Planer', TRUE)
  RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions
  WHERE key IN ('module:finanzplanung:read', 'module:finanzplanung:plan_cashout', 'module:finanzplanung:export_payment', 'module:finanzplanung:manage_suppliers')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'financial_approver', 'Finanzieller Genehmiger', TRUE)
  RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions
  WHERE key IN ('module:finanzplanung:read', 'module:finanzplanung:approve_payment')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  RETURN NEW;
END;
$$;

COMMIT;


-- ====== 029_suppliers.sql ======
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


-- ====== 030_invoices_incoming.sql ======
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


-- ====== 031_payment_infrastructure.sql ======
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


-- ====== 032_liquidity_extension.sql ======
-- 032_liquidity_extension.sql
-- Extend liquidity_event_instances with scheduled, residual, and invoice columns

BEGIN;

-- Rename plan_amount/plan_date to budget_amount/budget_date
ALTER TABLE public.liquidity_event_instances
  RENAME COLUMN plan_amount TO budget_amount;
ALTER TABLE public.liquidity_event_instances
  RENAME COLUMN plan_date TO budget_date;

-- Add scheduled columns (set by Cash-out Planer)
ALTER TABLE public.liquidity_event_instances
  ADD COLUMN IF NOT EXISTS scheduled_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS scheduled_date   DATE,
  ADD COLUMN IF NOT EXISTS scheduled_by     UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS scheduled_at     TIMESTAMPTZ;

-- Add residual value columns
ALTER TABLE public.liquidity_event_instances
  ADD COLUMN IF NOT EXISTS residual_1_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS residual_1_date   DATE,
  ADD COLUMN IF NOT EXISTS residual_2_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS residual_2_date   DATE,
  ADD COLUMN IF NOT EXISTS residual_3_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS residual_3_date   DATE;

-- Link to source invoice
ALTER TABLE public.liquidity_event_instances
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices_incoming(id);

-- Backward-compatibility view (plan_amount/plan_date aliases)
CREATE OR REPLACE VIEW public.liquidity_event_instances_compat AS
  SELECT *, budget_amount AS plan_amount, budget_date AS plan_date
  FROM public.liquidity_event_instances;

-- Display priority helper functions
CREATE OR REPLACE FUNCTION public.liq_display_amount(
  p_budget_amount    NUMERIC,
  p_scheduled_amount NUMERIC,
  p_actual_amount    NUMERIC
) RETURNS NUMERIC LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(p_actual_amount, p_scheduled_amount, p_budget_amount);
$$;

CREATE OR REPLACE FUNCTION public.liq_display_date(
  p_budget_date    DATE,
  p_scheduled_date DATE,
  p_actual_date    DATE
) RETURNS DATE LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(p_actual_date, p_scheduled_date, p_budget_date);
$$;

-- Update indexes for renamed columns
DROP INDEX IF EXISTS idx_liq_instances_company_date;
CREATE INDEX idx_liq_instances_company_date
  ON public.liquidity_event_instances (company_id, budget_date, marker_type)
  WHERE marker_type = 'event';

CREATE INDEX IF NOT EXISTS idx_liq_scheduled_date
  ON public.liquidity_event_instances (company_id, scheduled_date)
  WHERE scheduled_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_liq_invoice
  ON public.liquidity_event_instances (invoice_id)
  WHERE invoice_id IS NOT NULL;

COMMIT;


-- ====== 033_process_house.sql ======
-- 033_process_house.sql
-- Process House: M/P/S classification, ranking, and KPI system

BEGIN;

-- 1. Add process_type and house_sort_order to process_definitions
ALTER TABLE public.process_definitions
  ADD COLUMN IF NOT EXISTS process_type TEXT CHECK (process_type IS NULL OR process_type IN ('M', 'P', 'S')),
  ADD COLUMN IF NOT EXISTS house_sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_process_definitions_house
  ON public.process_definitions (company_id, process_type, house_sort_order)
  WHERE process_type IS NOT NULL;

-- 2. Process KPI definitions (designed by super-user)
CREATE TABLE IF NOT EXISTS public.process_kpi_definitions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id          UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id          UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  process_id          UUID NOT NULL REFERENCES public.process_definitions(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  description         TEXT,
  unit                TEXT NOT NULL DEFAULT '',
  target_value        NUMERIC(14,2),
  warning_threshold   NUMERIC(14,2),
  critical_threshold  NUMERIC(14,2),
  data_source         TEXT,
  visible_roles       TEXT[] NOT NULL DEFAULT '{}',
  sort_order          INTEGER DEFAULT 0,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_by          UUID REFERENCES public.profiles(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (process_id, name)
);

-- 3. Process KPI values (time-series data)
CREATE TABLE IF NOT EXISTS public.process_kpi_values (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id          UUID NOT NULL REFERENCES public.process_kpi_definitions(id) ON DELETE CASCADE,
  period_date     DATE NOT NULL,
  value           NUMERIC(14,2),
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (kpi_id, period_date)
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_process_kpi_defs_process
  ON public.process_kpi_definitions (process_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_process_kpi_defs_company
  ON public.process_kpi_definitions (company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_process_kpi_values_kpi
  ON public.process_kpi_values (kpi_id, period_date DESC);

-- 5. RLS
ALTER TABLE public.process_kpi_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_kpi_values ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['process_kpi_definitions', 'process_kpi_values']) LOOP
    EXECUTE format(
      'CREATE POLICY "enura_%s" ON public.%I FOR ALL USING (public.is_enura_admin())', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "holding_%s" ON public.%I FOR ALL USING (holding_id = public.current_holding_id() AND public.is_holding_admin())', tbl, tbl);
  END LOOP;
END $$;

-- KPI definitions: company users with process access can read
CREATE POLICY "company_read_kpi_defs" ON public.process_kpi_definitions FOR SELECT
  USING (company_id = public.current_company_id());

-- KPI values: readable if user can read the parent definition
CREATE POLICY "company_read_kpi_values" ON public.process_kpi_values FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.process_kpi_definitions d
    WHERE d.id = process_kpi_values.kpi_id
    AND d.company_id = public.current_company_id()
  ));

-- 6. Updated_at trigger
CREATE TRIGGER trg_process_kpi_defs_updated
  BEFORE UPDATE ON public.process_kpi_definitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;


-- ====== 034_process_phases.sql ======
-- 034_process_phases.sql
-- Aggregation layer: group process steps into phases with phase-level KPIs

-- 1. Process phases table
CREATE TABLE IF NOT EXISTS public.process_phases (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id       UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id       UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  process_id       UUID NOT NULL REFERENCES public.process_definitions(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  description      TEXT,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  color            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (process_id, name)
);

-- 2. Add phase_id to process_steps
ALTER TABLE public.process_steps
  ADD COLUMN IF NOT EXISTS phase_id UUID REFERENCES public.process_phases(id) ON DELETE SET NULL;

-- 3. Add phase_id to process_kpi_definitions
ALTER TABLE public.process_kpi_definitions
  ADD COLUMN IF NOT EXISTS phase_id UUID REFERENCES public.process_phases(id) ON DELETE CASCADE;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_process_phases_process
  ON public.process_phases (process_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_process_steps_phase
  ON public.process_steps (phase_id) WHERE phase_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_process_kpi_defs_phase
  ON public.process_kpi_definitions (phase_id) WHERE phase_id IS NOT NULL;

-- 5. RLS (same pattern as process_steps)
ALTER TABLE public.process_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "enura_admin_process_phases" ON public.process_phases FOR ALL
  USING (public.is_enura_admin());
CREATE POLICY "holding_admin_process_phases" ON public.process_phases FOR ALL
  USING (holding_id = public.current_holding_id() AND public.is_holding_admin());
CREATE POLICY "company_user_process_phases" ON public.process_phases FOR SELECT
  USING (company_id = public.current_company_id()
         OR (company_id IS NULL AND holding_id = public.current_holding_id()));

-- 6. Updated_at trigger
CREATE TRIGGER trg_process_phases_updated
  BEFORE UPDATE ON public.process_phases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ====== 035_step_criticality_rhythm.sql ======
-- 035: Add criticality and rhythm fields to process_steps
ALTER TABLE public.process_steps
  ADD COLUMN IF NOT EXISTS criticality TEXT CHECK (criticality IS NULL OR criticality IN ('A', 'B', 'C')),
  ADD COLUMN IF NOT EXISTS rhythm TEXT;


-- ====== 036_project_documents.sql ======
-- 036: Project documents table for attachments (photos, drawings, invoices, etc.)

CREATE TABLE IF NOT EXISTS public.project_documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id       UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id       UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id       UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  document_type    TEXT NOT NULL CHECK (document_type IN (
    'voice_note', 'email', 'drawing', 'photo', 'video',
    'invoice_customer', 'invoice_supplier', 'contract', 'offer', 'report', 'other'
  )),
  title            TEXT NOT NULL,
  description      TEXT,
  storage_path     TEXT NOT NULL,
  filename         TEXT,
  mime_type        TEXT,
  file_size        INTEGER,
  uploaded_by      UUID REFERENCES public.profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_documents_project
  ON public.project_documents (project_id, document_type);

ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "enura_project_documents" ON public.project_documents FOR ALL
  USING (public.is_enura_admin());
CREATE POLICY "holding_project_documents" ON public.project_documents FOR ALL
  USING (holding_id = public.current_holding_id() AND public.is_holding_admin());
CREATE POLICY "company_project_documents" ON public.project_documents FOR ALL
  USING (company_id = public.current_company_id());


-- ====== 037_extend_projects.sql ======
-- 037: Add description, value, size, and start date to projects

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS project_value NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS system_size_kwp NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS project_start_date DATE;


-- ====== 038_seed_payment_runs.sql ======
-- 038: Seed payment runs from existing invoices with status 'in_payment_run'
-- Groups invoices by company and creates one payment run per company.

DO $$
DECLARE
  rec RECORD;
  run_id UUID;
  admin_id UUID;
BEGIN
  FOR rec IN
    SELECT DISTINCT i.company_id, i.holding_id
    FROM public.invoices_incoming i
    WHERE i.status = 'in_payment_run'
  LOOP
    -- Pick any profile in this company as the creator
    SELECT p.id INTO admin_id
    FROM public.profiles p
    WHERE p.company_id = rec.company_id
    LIMIT 1;

    IF admin_id IS NULL THEN CONTINUE; END IF;

    run_id := gen_random_uuid();

    INSERT INTO public.payment_runs (
      id, holding_id, company_id, run_date, name,
      created_by, total_amount, item_count, currency, status,
      submitted_at, submitted_by
    )
    SELECT
      run_id,
      rec.holding_id,
      rec.company_id,
      CURRENT_DATE,
      'Zahlungslauf ' || TO_CHAR(CURRENT_DATE, 'DD.MM.YYYY'),
      admin_id,
      COALESCE(SUM(i.gross_amount), 0),
      COUNT(*)::INTEGER,
      'CHF',
      'submitted',
      NOW(),
      admin_id
    FROM public.invoices_incoming i
    WHERE i.company_id = rec.company_id
      AND i.status = 'in_payment_run';

    -- Create payment run items
    INSERT INTO public.payment_run_items (
      run_id, holding_id, company_id, invoice_id,
      creditor_name, creditor_iban, amount, currency, sort_order
    )
    SELECT
      run_id,
      rec.holding_id,
      rec.company_id,
      i.id,
      COALESCE(i.sender_name, 'Unbekannt'),
      'CH00 0000 0000 0000 0000 0',
      COALESCE(i.gross_amount, 0),
      COALESCE(i.currency, 'CHF'),
      ROW_NUMBER() OVER (ORDER BY i.due_date)::INTEGER
    FROM public.invoices_incoming i
    WHERE i.company_id = rec.company_id
      AND i.status = 'in_payment_run';
  END LOOP;
END $$;


-- ====== 039_planned_payment_date.sql ======
-- 039: Add planned_payment_date to invoices_incoming
-- This stores the forecasted payment date set by the cash-out planner.
-- due_date remains the supplier's original payment term.

ALTER TABLE public.invoices_incoming
  ADD COLUMN IF NOT EXISTS planned_payment_date DATE;

-- Backfill: set planned_payment_date = due_date for scheduled invoices
UPDATE public.invoices_incoming
SET planned_payment_date = due_date
WHERE status IN ('scheduled', 'in_payment_run', 'paid')
  AND planned_payment_date IS NULL;


-- ====== 040_link_calls_to_projects.sql ======
-- 040: Link calls and calendar_events to projects/leads
-- Enables project-level communication tracking for Setter and Berater tabs

BEGIN;

-- 1. Add project_id and lead_id to calls
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id),
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id);

CREATE INDEX IF NOT EXISTS idx_calls_project ON public.calls (project_id)
  WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_lead ON public.calls (lead_id)
  WHERE lead_id IS NOT NULL;

-- 2. Add project_id and lead_id to calendar_events
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id),
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id);

CREATE INDEX IF NOT EXISTS idx_calendar_events_project ON public.calendar_events (project_id)
  WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_lead ON public.calendar_events (lead_id)
  WHERE lead_id IS NOT NULL;

-- 3. Backfill: Match calls to leads via phone number, then to projects via lead_id
UPDATE public.calls c
SET lead_id = l.id,
    project_id = p.id
FROM public.leads l
LEFT JOIN public.projects p ON p.lead_id = l.id AND p.company_id = l.company_id
WHERE (c.caller_number = l.phone OR c.callee_number = l.phone)
  AND c.company_id = l.company_id
  AND c.lead_id IS NULL
  AND l.phone IS NOT NULL
  AND l.phone != '';

-- 4. Backfill: Match calendar_events to leads/projects via team_member_id
-- Calendar events don't have phone numbers, so match via the berater/setter assignment
UPDATE public.calendar_events ce
SET project_id = p.id,
    lead_id = p.lead_id
FROM public.projects p
WHERE p.berater_id = ce.team_member_id
  AND p.company_id = ce.company_id
  AND p.status = 'active'
  AND ce.project_id IS NULL;

COMMIT;


-- ====== 041_project_current_step.sql ======
-- 041: Add current process step tracking to projects
-- Stores the current Kanban step for each project

BEGIN;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS current_step_id UUID REFERENCES public.process_steps(id),
  ADD COLUMN IF NOT EXISTS current_step_name TEXT;

CREATE INDEX IF NOT EXISTS idx_projects_current_step ON public.projects (current_step_id)
  WHERE current_step_id IS NOT NULL;

-- Backfill: Assign each project a step based on its age across the process steps
-- This mirrors the API logic that distributes projects by age
DO $$
DECLARE
  comp RECORD;
  proc RECORD;
  step_arr UUID[];
  step_names TEXT[];
  step_count INTEGER;
  proj RECORD;
  ages NUMERIC[];
  min_age NUMERIC;
  max_age NUMERIC;
  age_span NUMERIC;
  age_days NUMERIC;
  normalized NUMERIC;
  step_idx INTEGER;
BEGIN
  -- For each company
  FOR comp IN SELECT DISTINCT company_id FROM public.projects WHERE status = 'active' LOOP
    -- For each deployed P-type process in this company
    FOR proc IN
      SELECT pd.id
      FROM public.process_definitions pd
      WHERE pd.company_id = comp.company_id
        AND pd.status = 'deployed'
        AND pd.process_type = 'P'
      ORDER BY pd.house_sort_order
      LIMIT 1  -- Use the first P-process (main value chain)
    LOOP
      -- Get ordered steps
      SELECT array_agg(ps.id ORDER BY ps.sort_order),
             array_agg(ps.name ORDER BY ps.sort_order)
      INTO step_arr, step_names
      FROM public.process_steps ps
      WHERE ps.process_id = proc.id;

      step_count := coalesce(array_length(step_arr, 1), 0);
      IF step_count = 0 THEN CONTINUE; END IF;

      -- Calculate age range
      SELECT MIN(EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 86400),
             MAX(EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 86400)
      INTO min_age, max_age
      FROM public.projects p
      WHERE p.company_id = comp.company_id AND p.status = 'active';

      age_span := GREATEST(max_age - min_age, 1);

      -- Assign each project
      FOR proj IN
        SELECT id, created_at
        FROM public.projects
        WHERE company_id = comp.company_id AND status = 'active'
      LOOP
        age_days := EXTRACT(EPOCH FROM (NOW() - proj.created_at)) / 86400;
        normalized := (age_days - min_age) / age_span;
        step_idx := LEAST(step_count, GREATEST(1, FLOOR(normalized * step_count) + 1));

        UPDATE public.projects
        SET current_step_id = step_arr[step_idx],
            current_step_name = step_names[step_idx]
        WHERE id = proj.id;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

COMMIT;


-- ====== 042_inverter_heatpump.sql ======
-- 042: Add inverter and heatpump size to projects

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS inverter_size_kw NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS heatpump_size_kw NUMERIC(8,2);

-- Backfill seed data with realistic values
-- ~70% of projects get an inverter (sized to match PV), ~30% get a heatpump
UPDATE public.projects
SET inverter_size_kw = ROUND((system_size_kwp * (0.8 + random() * 0.4))::NUMERIC, 1)
WHERE system_size_kwp IS NOT NULL
  AND inverter_size_kw IS NULL;

UPDATE public.projects
SET heatpump_size_kw = ROUND((5 + random() * 15)::NUMERIC, 1)
WHERE system_size_kwp IS NOT NULL
  AND heatpump_size_kw IS NULL
  AND random() < 0.3;


-- ====== 043_step_kpi_snapshots.sql ======
-- 043: Step KPI snapshots for month-over-month comparison
-- Stores daily project counts and portfolio values per process step

CREATE TABLE IF NOT EXISTS public.step_kpi_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES public.process_steps(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  project_count INTEGER NOT NULL DEFAULT 0,
  portfolio_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (step_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_step_kpi_snapshots_company_date
  ON public.step_kpi_snapshots (company_id, snapshot_date);

ALTER TABLE public.step_kpi_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "step_kpi_enura" ON public.step_kpi_snapshots FOR ALL
  USING (public.is_enura_admin());
CREATE POLICY "step_kpi_holding" ON public.step_kpi_snapshots FOR ALL
  USING (public.is_holding_admin());
CREATE POLICY "step_kpi_company" ON public.step_kpi_snapshots FOR SELECT
  USING (company_id = public.current_company_id());

-- Backfill: create a snapshot for today based on current project distribution
INSERT INTO public.step_kpi_snapshots (company_id, step_id, snapshot_date, project_count, portfolio_value)
SELECT
  p.company_id,
  p.current_step_id,
  CURRENT_DATE,
  COUNT(*)::INTEGER,
  COALESCE(SUM(p.project_value), 0)
FROM public.projects p
WHERE p.status = 'active'
  AND p.current_step_id IS NOT NULL
GROUP BY p.company_id, p.current_step_id
ON CONFLICT (step_id, snapshot_date) DO UPDATE
  SET project_count = EXCLUDED.project_count,
      portfolio_value = EXCLUDED.portfolio_value;

-- Also create a "last month" snapshot (30 days ago) with slightly different values
-- to enable trend comparison from the start
INSERT INTO public.step_kpi_snapshots (company_id, step_id, snapshot_date, project_count, portfolio_value)
SELECT
  company_id,
  step_id,
  CURRENT_DATE - INTERVAL '30 days',
  GREATEST(project_count + (CASE WHEN random() > 0.5 THEN -1 ELSE 1 END) * FLOOR(random() * 3)::INTEGER, 0),
  GREATEST(portfolio_value * (0.85 + random() * 0.3), 0)
FROM public.step_kpi_snapshots
WHERE snapshot_date = CURRENT_DATE
ON CONFLICT (step_id, snapshot_date) DO NOTHING;


-- ====== 044_redistribute_projects.sql ======
-- 044: Redistribute seeded projects across P1, P2, P3 process steps
-- Currently 104/123 projects sit in A-01 (first step of P1).
-- Realistically, projects should be distributed across the full value chain.

DO $$
DECLARE
  comp_id UUID := '700a1760-6ba7-4dd7-9e11-6c3a304fab8f';
  p1_id UUID;
  p2_id UUID;
  p3_id UUID;
  p1_steps UUID[];
  p1_names TEXT[];
  p2_steps UUID[];
  p2_names TEXT[];
  p3_steps UUID[];
  p3_names TEXT[];
  total_steps INTEGER;
  proj RECORD;
  proj_count INTEGER;
  proj_idx INTEGER := 0;
  step_idx INTEGER;
  target_step UUID;
  target_name TEXT;
BEGIN
  -- Get P-process IDs (ordered by house_sort_order)
  SELECT id INTO p1_id FROM process_definitions
    WHERE company_id = comp_id AND process_type = 'P' AND house_sort_order = 0;
  SELECT id INTO p2_id FROM process_definitions
    WHERE company_id = comp_id AND process_type = 'P' AND house_sort_order = 1;
  SELECT id INTO p3_id FROM process_definitions
    WHERE company_id = comp_id AND process_type = 'P' AND house_sort_order = 2;

  IF p1_id IS NULL OR p2_id IS NULL OR p3_id IS NULL THEN
    RAISE NOTICE 'Not all 3 P-processes found, skipping';
    RETURN;
  END IF;

  -- Get steps for each process
  SELECT array_agg(id ORDER BY sort_order), array_agg(name ORDER BY sort_order)
  INTO p1_steps, p1_names FROM process_steps WHERE process_id = p1_id;

  SELECT array_agg(id ORDER BY sort_order), array_agg(name ORDER BY sort_order)
  INTO p2_steps, p2_names FROM process_steps WHERE process_id = p2_id;

  SELECT array_agg(id ORDER BY sort_order), array_agg(name ORDER BY sort_order)
  INTO p3_steps, p3_names FROM process_steps WHERE process_id = p3_id;

  -- Combine all steps into one array (P1 â†’ P2 â†’ P3)
  total_steps := array_length(p1_steps, 1) + array_length(p2_steps, 1) + array_length(p3_steps, 1);

  -- Count active projects
  SELECT count(*) INTO proj_count FROM projects
    WHERE company_id = comp_id AND status = 'active';

  -- Distribute projects by age (oldest = furthest along)
  FOR proj IN
    SELECT id, created_at FROM projects
    WHERE company_id = comp_id AND status = 'active'
    ORDER BY created_at ASC  -- oldest first = furthest along
  LOOP
    -- Map project index to a combined step index across all 3 processes
    step_idx := LEAST(total_steps, GREATEST(1,
      FLOOR((proj_idx::NUMERIC / GREATEST(proj_count, 1)) * total_steps) + 1
    ));

    -- Determine which process and step
    IF step_idx <= array_length(p1_steps, 1) THEN
      target_step := p1_steps[step_idx];
      target_name := p1_names[step_idx];
    ELSIF step_idx <= array_length(p1_steps, 1) + array_length(p2_steps, 1) THEN
      target_step := p2_steps[step_idx - array_length(p1_steps, 1)];
      target_name := p2_names[step_idx - array_length(p1_steps, 1)];
    ELSE
      target_step := p3_steps[step_idx - array_length(p1_steps, 1) - array_length(p2_steps, 1)];
      target_name := p3_names[step_idx - array_length(p1_steps, 1) - array_length(p2_steps, 1)];
    END IF;

    UPDATE projects
    SET current_step_id = target_step,
        current_step_name = target_name
    WHERE id = proj.id;

    proj_idx := proj_idx + 1;
  END LOOP;

  RAISE NOTICE 'Redistributed % projects across % steps (P1+P2+P3)', proj_count, total_steps;
END $$;

-- Update today's KPI snapshots with new distribution
DELETE FROM step_kpi_snapshots WHERE snapshot_date = CURRENT_DATE;

INSERT INTO step_kpi_snapshots (company_id, step_id, snapshot_date, project_count, portfolio_value)
SELECT
  p.company_id, p.current_step_id, CURRENT_DATE,
  COUNT(*)::INTEGER, COALESCE(SUM(p.project_value), 0)
FROM projects p
WHERE p.status = 'active' AND p.current_step_id IS NOT NULL
GROUP BY p.company_id, p.current_step_id;


-- ====== 045_supplier_bank_data_protection.sql ======
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
-- 2. supplier_bank_data â€” versioned, approved bank details
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
-- 3. supplier_bank_change_requests â€” approval workflow
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
-- 4. supplier_bank_change_log â€” immutable audit trail
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
-- 5. Alter suppliers â€” add verification columns
-- =========================================================================

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS bank_data_verified BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS active_bank_data_id UUID REFERENCES public.supplier_bank_data(id);

-- =========================================================================
-- 6. Alter payment_run_items â€” enforce supplier + bank data reference
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

  -- Force creditor fields to match approved data â€” no manual override possible
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


-- ====== 046_optional_2fa.sql ======
-- 046_optional_2fa.sql
-- Make 2FA optional per company (default: optional)

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS require_2fa BOOLEAN NOT NULL DEFAULT FALSE;


-- ====== 047_webhook_events.sql ======
-- =============================================================================
-- 047_webhook_events.sql
--
-- Stores incoming webhook deliveries for idempotency + audit.
-- Used by:
--   - /api/webhooks/reonic (offer.signed â†’ Bexio order)
--   - future webhook receivers (3CX, Google Calendar push, etc.)
-- =============================================================================

CREATE TABLE webhook_events (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id           UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    source               TEXT NOT NULL,            -- 'reonic', '3cx', 'gcal', ...
    external_event_id    TEXT,                     -- Provider's unique event ID (for dedup)
    event_type           TEXT NOT NULL,            -- 'offer.signed', 'offer.created', ...
    payload              JSONB NOT NULL,
    status               TEXT NOT NULL DEFAULT 'received',  -- received, processed, error
    error_message        TEXT,
    received_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at         TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_webhook_events_dedup
    ON webhook_events(source, external_event_id)
    WHERE external_event_id IS NOT NULL;

CREATE INDEX idx_webhook_events_company_received
    ON webhook_events(company_id, received_at DESC);

CREATE INDEX idx_webhook_events_status
    ON webhook_events(status, received_at DESC)
    WHERE status IN ('received', 'error');

-- RLS: tenants see their own events, holding admins see all
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY webhook_events_select ON webhook_events
    FOR SELECT USING (
        is_holding_admin() OR company_id = current_tenant_id()
    );

-- Inserts come from the service-role client only (webhook receivers run
-- server-side with the service role key) â€” no user-facing INSERT policy needed.



