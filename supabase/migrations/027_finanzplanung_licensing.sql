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
