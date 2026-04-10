-- =============================================================================
-- Migration 007: Email Activity Table
-- Enura Group Multi-Tenant BI Platform
--
-- Contains: email_activity table for Gmail connector daily aggregates.
-- Stores only counts — never email content.
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
