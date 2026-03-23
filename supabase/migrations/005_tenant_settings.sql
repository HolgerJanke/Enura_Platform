-- Migration 005: Tenant settings for report configuration
-- Phase 5 — AI Pipeline

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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  ('module:reports:daily', 'Tagesbericht', 'Täglichen Coaching-Bericht erhalten'),
  ('module:ai:callanalysis', 'KI-Anrufanalyse', 'KI-Anrufanalysen einsehen')
ON CONFLICT (key) DO NOTHING;
