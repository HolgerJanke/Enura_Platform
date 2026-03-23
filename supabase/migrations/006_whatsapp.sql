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
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
