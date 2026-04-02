-- Fix: seed_company_roles() trigger uses column "name" but the actual column is "key"
-- Also fix init_company_branding() and init_company_settings() if needed

CREATE OR REPLACE FUNCTION public.seed_company_roles()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_super_role_id UUID;
BEGIN
  -- Insert roles using "key" column (not "name" which doesn't exist)
  INSERT INTO public.roles (company_id, holding_id, key, label, is_super, is_system)
  VALUES (NEW.id, NEW.holding_id, 'super_user', 'Super User', TRUE, TRUE)
  RETURNING id INTO v_super_role_id;

  INSERT INTO public.roles (company_id, holding_id, key, label, is_system) VALUES
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
