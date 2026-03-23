-- Migration 004: Daily reports archive and tenant settings
-- Phase 5 — AI Pipeline

-- Daily reports archive
CREATE TABLE IF NOT EXISTS public.daily_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
