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
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Permissions
CREATE TABLE IF NOT EXISTS permissions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key         TEXT NOT NULL UNIQUE,
    label       TEXT NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Role Permissions
CREATE TABLE IF NOT EXISTS role_permissions (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(role_id, permission_id)
);

-- Profile Roles
CREATE TABLE IF NOT EXISTS profile_roles (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit Log (simplified — regular table, NOT a hypertable for Phase 2)
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
        (NEW.id, 'super_user', 'Super User', 'Vollständiger Mandantenadministrator', true),
        (NEW.id, 'geschaeftsfuehrung', 'Geschäftsführung', 'Alle Module, alle Mitarbeiter, Coaching-Ansicht', true),
        (NEW.id, 'teamleiter', 'Teamleiter', 'Team-KPIs (Setter ODER Berater), keine Finanzen', true),
        (NEW.id, 'setter', 'Setter', 'Eigene Anrufe, eigene Termine, eigene KPIs', true),
        (NEW.id, 'berater', 'Berater', 'Eigene Pipeline, eigene Termine, eigene KPIs', true),
        (NEW.id, 'innendienst', 'Innendienst', 'Planung, Projektphasen, IA-Status', true),
        (NEW.id, 'bau', 'Bau / Montage', 'Zugewiesene Projekte, Installationstermine, Material', true),
        (NEW.id, 'buchhaltung', 'Buchhaltung', 'Rechnungen, Cashflow, Zahlungen', true),
        (NEW.id, 'leadkontrolle', 'Leadkontrolle', 'Alle Leads, Lead-Qualität', true);

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
    ('holding:global', 'Holding-Zugriff', 'Vollständiger Holding-Administrator-Zugriff')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- End of Migration 001
-- =============================================================================
