-- 050_finanzplanung_buchhaltung_and_bankdata.sql
-- (1) buchhaltung = the Finanzplanung "Planer" per architecture.md §8: grant it the
--     cashout-planner capability set.
-- (2) F-P6: seed the two bank-data-workflow keys used in code but never seeded, assign
--     them (validator reviews, financial_approver approves — 4-eyes with cashout_planner/
--     buchhaltung as requester), and add the missing company-tier UPDATE RLS policy on
--     supplier_bank_change_requests so a permitted reviewer/approver's update is not no-op'd.
-- (3) FIX a regression from migration 049: its seed_company_roles() was rebuilt from 026
--     (9 roles) and dropped the 4 finanzplanung roles that 028 had added. This restores all
--     13 roles (with innendienst's bau:read from 049 and the new grants below).

BEGIN;

-- (2a) New bank-data-workflow permissions.
INSERT INTO public.permissions (key, label, description) VALUES
  ('module:finanzplanung:review_bank_data',  'Bankdaten prüfen',     'Lieferanten-Bankdatenänderungen prüfen (Prüfer)'),
  ('module:finanzplanung:approve_bank_data', 'Bankdaten genehmigen', 'Lieferanten-Bankdatenänderungen genehmigen (Genehmiger)')
ON CONFLICT (key) DO NOTHING;

-- (1)+(2b) Back-fill existing roles.
DO $$
BEGIN
  -- buchhaltung: cashout-planner capability set (#1).
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM public.roles r, public.permissions p
  WHERE r.key = 'buchhaltung'
    AND p.key IN ('module:finanzplanung:read', 'module:finanzplanung:plan_cashout',
                  'module:finanzplanung:export_payment', 'module:finanzplanung:manage_suppliers')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- validator reviews bank data; financial_approver approves it (#2).
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM public.roles r, public.permissions p
  WHERE r.key = 'validator' AND p.key = 'module:finanzplanung:review_bank_data'
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM public.roles r, public.permissions p
  WHERE r.key = 'financial_approver' AND p.key = 'module:finanzplanung:approve_bank_data'
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- super_user holds everything.
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM public.roles r, public.permissions p
  WHERE r.key = 'super_user'
    AND p.key IN ('module:finanzplanung:review_bank_data', 'module:finanzplanung:approve_bank_data')
  ON CONFLICT (role_id, permission_id) DO NOTHING;
END $$;

-- (2c) Missing company-tier UPDATE policy on supplier_bank_change_requests.
-- Holding/enura admins already have FOR ALL. Company reviewers/approvers need FOR UPDATE,
-- scoped to their own company and gated on the bank-data capabilities.
DROP POLICY IF EXISTS "sbd_company_review_approve" ON public.supplier_bank_change_requests;
CREATE POLICY "sbd_company_review_approve"
  ON public.supplier_bank_change_requests
  FOR UPDATE
  USING (
    company_id = public.current_company_id()
    AND (public.has_permission('module:finanzplanung:review_bank_data')
         OR public.has_permission('module:finanzplanung:approve_bank_data'))
  )
  WITH CHECK (company_id = public.current_company_id());

-- (3) Rebuild seed_company_roles() with ALL 13 roles + every accumulated change
-- (innendienst bau:read from 049; buchhaltung planner set; validator review_bank_data;
-- financial_approver approve_bank_data). super_user still gets ALL permissions.
CREATE OR REPLACE FUNCTION public.seed_company_roles()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_role_id UUID;
BEGIN
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'super_user', 'Super User', TRUE) RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions;

  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'geschaeftsfuehrung', 'Geschäftsführung', TRUE) RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE key LIKE 'module:%:read'
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'teamleiter', 'Teamleiter', TRUE) RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions
  WHERE key IN ('module:setter:read', 'module:berater:read', 'module:leads:read', 'module:reports:read')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'setter', 'Setter', TRUE) RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE key = 'module:setter:read'
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'berater', 'Berater', TRUE) RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE key = 'module:berater:read'
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'innendienst', 'Innendienst', TRUE) RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions
  WHERE key IN ('module:innendienst:read', 'module:innendienst:write', 'module:bau:read')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'bau', 'Bau / Montage', TRUE) RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE key IN ('module:bau:read', 'module:bau:write')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- buchhaltung: finance + finanzplanung planner set (#1)
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'buchhaltung', 'Buchhaltung', TRUE) RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions
  WHERE key IN ('module:finance:read', 'module:finance:write',
                'module:finanzplanung:read', 'module:finanzplanung:plan_cashout',
                'module:finanzplanung:export_payment', 'module:finanzplanung:manage_suppliers')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'leadkontrolle', 'Leadkontrolle', TRUE) RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE key IN ('module:leads:read', 'module:leads:write')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- Finanzplanung roles (restored — 049 had dropped these)
  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'validator', 'Rechnungspruefer', TRUE) RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions
  WHERE key IN ('module:finanzplanung:read', 'module:finanzplanung:validate', 'module:finanzplanung:review_bank_data')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'invoice_approver', 'Rechnungsgenehmiger', TRUE) RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions
  WHERE key IN ('module:finanzplanung:read', 'module:finanzplanung:approve_invoice')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'cashout_planner', 'Cash-out-Planer', TRUE) RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions
  WHERE key IN ('module:finanzplanung:read', 'module:finanzplanung:plan_cashout', 'module:finanzplanung:export_payment', 'module:finanzplanung:manage_suppliers')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  INSERT INTO public.roles (company_id, holding_id, key, label, is_system)
  VALUES (NEW.id, NEW.holding_id, 'financial_approver', 'Finanzieller Genehmiger', TRUE) RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions
  WHERE key IN ('module:finanzplanung:read', 'module:finanzplanung:approve_payment', 'module:finanzplanung:approve_bank_data')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  RETURN NEW;
END;
$$;

COMMIT;
