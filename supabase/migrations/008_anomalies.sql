-- =============================================================================
-- Migration 008: Anomaly detection table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.anomalies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
