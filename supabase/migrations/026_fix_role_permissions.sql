-- 026_fix_role_permissions.sql
-- Fix: seed_company_roles() only assigned permissions to super_user.
-- All other roles (setter, berater, etc.) had zero permissions, causing
-- users to see only the Dashboard in the sidebar.
--
-- This migration:
-- 1. Assigns correct permissions to ALL existing roles for all companies
-- 2. Updates the trigger to do the same for future companies

-- ============================================================================
-- 1. Back-fill permissions for existing roles
-- ============================================================================

DO $$
DECLARE
  v_role RECORD;
  v_perm_id UUID;
BEGIN
  -- geschaeftsfuehrung: ALL module:*:read permissions + reports
  FOR v_role IN SELECT id FROM public.roles WHERE key = 'geschaeftsfuehrung'
  LOOP
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_role.id, p.id FROM public.permissions p
    WHERE p.key LIKE 'module:%:read'
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END LOOP;

  -- teamleiter: setter, berater, leads read + reports read
  FOR v_role IN SELECT id FROM public.roles WHERE key = 'teamleiter'
  LOOP
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_role.id, p.id FROM public.permissions p
    WHERE p.key IN ('module:setter:read', 'module:berater:read', 'module:leads:read', 'module:reports:read')
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END LOOP;

  -- setter: setter read
  FOR v_role IN SELECT id FROM public.roles WHERE key = 'setter'
  LOOP
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_role.id, p.id FROM public.permissions p
    WHERE p.key IN ('module:setter:read')
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END LOOP;

  -- berater: berater read
  FOR v_role IN SELECT id FROM public.roles WHERE key = 'berater'
  LOOP
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_role.id, p.id FROM public.permissions p
    WHERE p.key IN ('module:berater:read')
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END LOOP;

  -- innendienst: innendienst read + write
  FOR v_role IN SELECT id FROM public.roles WHERE key = 'innendienst'
  LOOP
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_role.id, p.id FROM public.permissions p
    WHERE p.key IN ('module:innendienst:read', 'module:innendienst:write')
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END LOOP;

  -- bau: bau read + write
  FOR v_role IN SELECT id FROM public.roles WHERE key = 'bau'
  LOOP
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_role.id, p.id FROM public.permissions p
    WHERE p.key IN ('module:bau:read', 'module:bau:write')
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END LOOP;

  -- buchhaltung: finance read + write
  FOR v_role IN SELECT id FROM public.roles WHERE key = 'buchhaltung'
  LOOP
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_role.id, p.id FROM public.permissions p
    WHERE p.key IN ('module:finance:read', 'module:finance:write')
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END LOOP;

  -- leadkontrolle: leads read + write
  FOR v_role IN SELECT id FROM public.roles WHERE key = 'leadkontrolle'
  LOOP
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_role.id, p.id FROM public.permissions p
    WHERE p.key IN ('module:leads:read', 'module:leads:write')
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END LOOP;
END $$;

-- ============================================================================
-- 2. Update seed_company_roles trigger to assign per-role permissions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.seed_company_roles()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_role_id UUID;
BEGIN
  -- Create super_user role and assign ALL permissions
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'super_user', 'Super User', TRUE)
  RETURNING id INTO v_role_id;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions;

  -- geschaeftsfuehrung: all read permissions
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'geschaeftsfuehrung', 'Geschaeftsfuehrung', TRUE)
  RETURNING id INTO v_role_id;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE key LIKE 'module:%:read'
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- teamleiter: setter, berater, leads, reports read
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'teamleiter', 'Teamleiter', TRUE)
  RETURNING id INTO v_role_id;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions
  WHERE key IN ('module:setter:read', 'module:berater:read', 'module:leads:read', 'module:reports:read')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- setter: setter read
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'setter', 'Setter', TRUE)
  RETURNING id INTO v_role_id;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE key = 'module:setter:read'
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- berater: berater read
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'berater', 'Berater', TRUE)
  RETURNING id INTO v_role_id;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE key = 'module:berater:read'
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- innendienst: innendienst read + write
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'innendienst', 'Innendienst', TRUE)
  RETURNING id INTO v_role_id;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE key IN ('module:innendienst:read', 'module:innendienst:write')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- bau: bau read + write
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'bau', 'Bau / Montage', TRUE)
  RETURNING id INTO v_role_id;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE key IN ('module:bau:read', 'module:bau:write')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- buchhaltung: finance read + write
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'buchhaltung', 'Buchhaltung', TRUE)
  RETURNING id INTO v_role_id;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE key IN ('module:finance:read', 'module:finance:write')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- leadkontrolle: leads read + write
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'leadkontrolle', 'Leadkontrolle', TRUE)
  RETURNING id INTO v_role_id;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE key IN ('module:leads:read', 'module:leads:write')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  RETURN NEW;
END;
$$;
