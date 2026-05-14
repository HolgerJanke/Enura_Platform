-- =============================================================================
-- 047_webhook_events.sql
--
-- Stores incoming webhook deliveries for idempotency + audit.
-- Used by:
--   - /api/webhooks/reonic (offer.signed → Bexio order)
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
-- server-side with the service role key) — no user-facing INSERT policy needed.
