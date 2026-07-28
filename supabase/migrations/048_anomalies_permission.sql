-- 048_anomalies_permission.sql
-- F-P1: give the /anomalies dashboard a dedicated permission so it is
-- management-only (super_user + geschaeftsfuehrung), separate from /reports.
--
-- Before this, /anomalies was gated on module:reports:read, which teamleiter
-- also holds (for /reports) — so teamleiter could reach /anomalies too. A
-- dedicated key fixes that without removing teamleiter's /reports access.
--
-- Why no trigger change is needed for future companies:
--   * super_user is seeded ALL permissions -> auto-gets this key.
--   * geschaeftsfuehrung is seeded every 'module:%:read' key -> 'module:anomalies:read'
--     matches, so it auto-gets it.
--   * teamleiter is seeded an explicit IN-list that does NOT include it -> excluded.
-- (See seed_company_roles() in 026_fix_role_permissions.sql.)
-- Only EXISTING companies' roles need the back-fill below.

INSERT INTO public.permissions (key, label, description) VALUES
  ('module:anomalies:read', 'Anomalien lesen', 'Anomalie-Dashboard anzeigen (Management)')
ON CONFLICT (key) DO NOTHING;

DO $$
DECLARE
  v_perm_id UUID;
BEGIN
  SELECT id INTO v_perm_id FROM public.permissions WHERE key = 'module:anomalies:read';

  -- Back-fill existing super_user + geschaeftsfuehrung roles across all companies.
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT r.id, v_perm_id
  FROM public.roles r
  WHERE r.key IN ('super_user', 'geschaeftsfuehrung')
  ON CONFLICT (role_id, permission_id) DO NOTHING;
END $$;
