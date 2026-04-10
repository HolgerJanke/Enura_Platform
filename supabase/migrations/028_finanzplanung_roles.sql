-- 028_finanzplanung_roles.sql
-- Four new Finanzplanung roles + permissions

BEGIN;

-- 1. Add Finanzplanung permissions (no 'module' column — key encodes it)
INSERT INTO public.permissions (key, label, description) VALUES
  ('module:finanzplanung:read',            'Finanzplanung lesen',              'Finanzplanungsmodul anzeigen'),
  ('module:finanzplanung:validate',        'Rechnungen prüfen',                'Eingangsrechnungen formal und inhaltlich prüfen'),
  ('module:finanzplanung:approve_invoice', 'Rechnungen genehmigen',            'Rechnungen technisch genehmigen'),
  ('module:finanzplanung:plan_cashout',    'Zahlungsausgänge planen',          'Zahlungsläufe erstellen und planen'),
  ('module:finanzplanung:approve_payment', 'Zahlungsläufe genehmigen',         'Zahlungsläufe final genehmigen'),
  ('module:finanzplanung:export_payment',  'Zahlungsdateien exportieren',      'Pain.001 / CSV Zahlungsdateien erzeugen'),
  ('module:finanzplanung:manage_suppliers','Lieferanten verwalten',            'Lieferanten-Stammdaten anlegen und bearbeiten')
ON CONFLICT (key) DO NOTHING;

-- 2. Seed four new roles into every existing company
DO $$
DECLARE
  v_company RECORD;
BEGIN
  FOR v_company IN SELECT id, holding_id FROM public.companies LOOP
    INSERT INTO public.roles (company_id, holding_id, key, label, is_system) VALUES
      (v_company.id, v_company.holding_id, 'validator',          'Rechnungspruefer',         TRUE),
      (v_company.id, v_company.holding_id, 'invoice_approver',   'Rechnungsgenehmiger',      TRUE),
      (v_company.id, v_company.holding_id, 'cashout_planner',    'Cash-out-Planer',          TRUE),
      (v_company.id, v_company.holding_id, 'financial_approver', 'Finanzieller Genehmiger',  TRUE)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- 3. Assign permissions to new roles (for all existing companies)
DO $$
DECLARE
  v_role RECORD;
BEGIN
  -- validator: read + validate
  FOR v_role IN SELECT id FROM public.roles WHERE key = 'validator' LOOP
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_role.id, p.id FROM public.permissions p
    WHERE p.key IN ('module:finanzplanung:read', 'module:finanzplanung:validate')
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END LOOP;

  -- invoice_approver: read + approve_invoice
  FOR v_role IN SELECT id FROM public.roles WHERE key = 'invoice_approver' LOOP
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_role.id, p.id FROM public.permissions p
    WHERE p.key IN ('module:finanzplanung:read', 'module:finanzplanung:approve_invoice')
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END LOOP;

  -- cashout_planner: read + plan_cashout + export_payment + manage_suppliers
  FOR v_role IN SELECT id FROM public.roles WHERE key = 'cashout_planner' LOOP
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_role.id, p.id FROM public.permissions p
    WHERE p.key IN (
      'module:finanzplanung:read',
      'module:finanzplanung:plan_cashout',
      'module:finanzplanung:export_payment',
      'module:finanzplanung:manage_suppliers'
    )
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END LOOP;

  -- financial_approver: read + approve_payment
  FOR v_role IN SELECT id FROM public.roles WHERE key = 'financial_approver' LOOP
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_role.id, p.id FROM public.permissions p
    WHERE p.key IN ('module:finanzplanung:read', 'module:finanzplanung:approve_payment')
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END LOOP;

  -- super_user: give all finanzplanung permissions to existing super_user roles
  FOR v_role IN SELECT id FROM public.roles WHERE key = 'super_user' LOOP
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_role.id, p.id FROM public.permissions p
    WHERE p.key LIKE 'module:finanzplanung:%'
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END LOOP;
END $$;

-- 4. Update seed_company_roles trigger to include new roles for future companies
CREATE OR REPLACE FUNCTION public.seed_company_roles()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_role_id UUID;
BEGIN
  -- super_user: ALL permissions
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'super_user', 'Super User', TRUE)
  RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions;

  -- geschaeftsfuehrung: all read permissions
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'geschaeftsfuehrung', 'Geschäftsführung', TRUE)
  RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE key LIKE 'module:%:read'
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- teamleiter
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'teamleiter', 'Teamleiter', TRUE)
  RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions
  WHERE key IN ('module:setter:read', 'module:berater:read', 'module:leads:read', 'module:reports:read')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- setter
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'setter', 'Setter', TRUE)
  RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE key = 'module:setter:read'
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- berater
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'berater', 'Berater', TRUE)
  RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE key = 'module:berater:read'
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- innendienst
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'innendienst', 'Innendienst', TRUE)
  RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE key IN ('module:innendienst:read', 'module:innendienst:write')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- bau
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'bau', 'Bau / Montage', TRUE)
  RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE key IN ('module:bau:read', 'module:bau:write')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- buchhaltung
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'buchhaltung', 'Buchhaltung', TRUE)
  RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE key IN ('module:finance:read', 'module:finance:write')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- leadkontrolle
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'leadkontrolle', 'Leadkontrolle', TRUE)
  RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE key IN ('module:leads:read', 'module:leads:write')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- Finanzplanung roles
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'validator', 'Rechnungspruefer', TRUE)
  RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions
  WHERE key IN ('module:finanzplanung:read', 'module:finanzplanung:validate')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'invoice_approver', 'Rechnungsgenehmiger', TRUE)
  RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions
  WHERE key IN ('module:finanzplanung:read', 'module:finanzplanung:approve_invoice')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'cashout_planner', 'Cash-out-Planer', TRUE)
  RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions
  WHERE key IN ('module:finanzplanung:read', 'module:finanzplanung:plan_cashout', 'module:finanzplanung:export_payment', 'module:finanzplanung:manage_suppliers')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'financial_approver', 'Finanzieller Genehmiger', TRUE)
  RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions
  WHERE key IN ('module:finanzplanung:read', 'module:finanzplanung:approve_payment')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  RETURN NEW;
END;
$$;

COMMIT;
