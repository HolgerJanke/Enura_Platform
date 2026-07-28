-- Remediation: strip the F-P2 dual-identity shape from EXISTING holding admins.
--
-- ⚠️  NOT a numbered migration on purpose. This modifies LIVE identities — run it
--     deliberately, after review, once you have provisioned the affected companies'
--     real super_user accounts. Do NOT let it auto-apply via `supabase db push`.
--
-- Context (F-P2 / OD-1 / CLAUDE.md §7): the old "New Holding" onboarding created the
-- holding admin with a company_id AND a company super_user role — a holding admin is
-- not a tenant user and must have neither. The onboarding code is fixed going forward
-- (platform/holdings/new/actions.ts, Option A). This script cleans up rows created by
-- the old flow. The authz policy already NEUTRALIZES the risk (sessionTiers excludes
-- admins from company tier), so this is data hygiene, not an emergency.
--
-- BEFORE RUNNING: for each affected holding, make sure its first company has a real
-- super_user account (a DIFFERENT profile, holding_id NULL), or the company will have
-- no super_user afterward. Preview the affected rows first (SELECT below), decide, then
-- run the UPDATE/DELETE inside the transaction.

-- 1. Preview: holding-admin profiles that still carry a company_id (the §7 violation).
SELECT p.id, p.first_name, p.last_name, p.holding_id, p.company_id
FROM public.profiles p
JOIN public.holding_admins_v2 ha ON ha.profile_id = p.id
WHERE p.company_id IS NOT NULL;

-- 2. Remediate (review the preview first, then run this block deliberately):
-- BEGIN;
--   -- Drop any company role assignments held by holding admins (e.g. the auto-granted super_user).
--   DELETE FROM public.profile_roles pr
--   USING public.holding_admins_v2 ha, public.roles r
--   WHERE pr.profile_id = ha.profile_id
--     AND pr.role_id = r.id
--     AND r.company_id IS NOT NULL;
--
--   -- Null the company_id on holding-admin profiles (they are holding-tier only).
--   UPDATE public.profiles p
--   SET company_id = NULL
--   FROM public.holding_admins_v2 ha
--   WHERE ha.profile_id = p.id
--     AND p.company_id IS NOT NULL;
-- COMMIT;

-- 3. Optional hardening (a data-model invariant): forbid the shape from recurring.
-- ALTER TABLE public.profiles
--   ADD CONSTRAINT profiles_holding_admin_no_company
--   CHECK ( id NOT IN (SELECT profile_id FROM public.holding_admins_v2) OR company_id IS NULL )
--   NOT VALID;   -- NOT VALID: enforce for new/updated rows without failing on legacy data pre-cleanup.
-- Note: a subquery CHECK is not supported by Postgres directly — enforce via a trigger instead if desired.
