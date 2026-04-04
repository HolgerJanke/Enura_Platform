-- ============================================================
-- Migration 014 — Update triggers and functions for three-tier
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
    (NEW.id, NEW.holding_id, 'geschaeftsfuehrung', 'Geschäftsführung',    TRUE),
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

-- 6. Keep is_holding_admin() backward compat — also check old table
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
