-- 049_innendienst_bau_read.sql
-- F-P7 / D1 (operator: grant innendienst /projects): innendienst does project
-- planning / project phases (CLAUDE.md §7), so it should reach the Bau & Montage
-- kanban (/projects, gated on module:bau:read). Migration 026 seeded innendienst
-- only innendienst:read/write, so it couldn't. Add module:bau:read for existing
-- innendienst roles AND update the seed trigger for future companies.

-- 1. Back-fill existing innendienst roles.
DO $$
DECLARE v_perm_id UUID;
BEGIN
  SELECT id INTO v_perm_id FROM public.permissions WHERE key = 'module:bau:read';
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT r.id, v_perm_id FROM public.roles r WHERE r.key = 'innendienst'
  ON CONFLICT (role_id, permission_id) DO NOTHING;
END $$;

-- 2. Update seed_company_roles() so new companies grant innendienst bau:read too.
--    (Identical to 026 except the innendienst permission list gains module:bau:read.)
CREATE OR REPLACE FUNCTION public.seed_company_roles()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_role_id UUID;
BEGIN
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'super_user', 'Super User', TRUE)
  RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions;

  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'geschaeftsfuehrung', 'Geschäftsführung', TRUE)
  RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE key LIKE 'module:%:read'
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'teamleiter', 'Teamleiter', TRUE)
  RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions
  WHERE key IN ('module:setter:read', 'module:berater:read', 'module:leads:read', 'module:reports:read')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'setter', 'Setter', TRUE)
  RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE key = 'module:setter:read'
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'berater', 'Berater', TRUE)
  RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE key = 'module:berater:read'
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- innendienst: innendienst read + write + bau read (D1)
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'innendienst', 'Innendienst', TRUE)
  RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions
  WHERE key IN ('module:innendienst:read', 'module:innendienst:write', 'module:bau:read')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'bau', 'Bau / Montage', TRUE)
  RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE key IN ('module:bau:read', 'module:bau:write')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'buchhaltung', 'Buchhaltung', TRUE)
  RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE key IN ('module:finance:read', 'module:finance:write')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'leadkontrolle', 'Leadkontrolle', TRUE)
  RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE key IN ('module:leads:read', 'module:leads:write')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  RETURN NEW;
END;
$$;
