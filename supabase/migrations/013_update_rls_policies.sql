-- ============================================================
-- Migration 013 — Rewrite all RLS policies for three-tier model
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
