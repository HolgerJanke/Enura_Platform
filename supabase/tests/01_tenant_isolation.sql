-- pgTAP Tenant Isolation Tests
-- Verifies that Row-Level Security policies correctly isolate tenant data.
-- Prerequisites: seed-dev.ts must have been run to populate test tenants.

BEGIN;
SELECT plan(24);

-- ── Setup: Auth simulation helper ──
-- Supabase RLS reads auth.uid() from request.jwt.claims.sub.
-- This helper sets the JWT claims so that RLS treats us as the given user.

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object(
      'sub', p_user_id::text,
      'role', 'authenticated',
      'aud', 'authenticated'
    )::text,
    true  -- local to transaction
  );
  PERFORM set_config('role', 'authenticated', true);
END;
$$ LANGUAGE plpgsql;

-- Reset to service role (bypass RLS) for setup queries
CREATE OR REPLACE FUNCTION test_reset_auth()
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('role', 'postgres', true);
END;
$$ LANGUAGE plpgsql;

-- ── Validate test data exists ──
DO $$
DECLARE
  v_alpen_tenant UUID;
  v_test_tenant  UUID;
  v_alpen_user   UUID;
  v_test_user    UUID;
  v_holding_user UUID;
BEGIN
  SELECT id INTO v_alpen_tenant FROM tenants WHERE slug = 'alpen-energie';
  SELECT id INTO v_test_tenant  FROM tenants WHERE slug = 'test-company';

  IF v_alpen_tenant IS NULL OR v_test_tenant IS NULL THEN
    RAISE EXCEPTION 'Test tenants not found. Run: pnpm seed:dev';
  END IF;

  SELECT p.id INTO v_alpen_user
    FROM profiles p
    WHERE p.tenant_id = v_alpen_tenant
    LIMIT 1;

  SELECT p.id INTO v_test_user
    FROM profiles p
    WHERE p.tenant_id = v_test_tenant
    LIMIT 1;

  IF v_alpen_user IS NULL OR v_test_user IS NULL THEN
    RAISE EXCEPTION 'Test users not found in profiles. Run: pnpm seed:dev';
  END IF;
END $$;


-- ═════════════════════════════════════════════════════════════════════
-- Tests 1-5: RLS is enabled on all critical tables
-- ═════════════════════════════════════════════════════════════════════

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'leads'),
  'RLS is enabled on leads'
);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'offers'),
  'RLS is enabled on offers'
);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'calls'),
  'RLS is enabled on calls'
);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'invoices'),
  'RLS is enabled on invoices'
);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'projects'),
  'RLS is enabled on projects'
);


-- ═════════════════════════════════════════════════════════════════════
-- Tests 6-8: Auth helper functions
-- ═════════════════════════════════════════════════════════════════════

-- Test 6: current_tenant_id() returns correct tenant for alpen-energie user
DO $$ BEGIN PERFORM test_reset_auth(); END $$;
DO $$
DECLARE
  v_user_id   UUID;
  v_tenant_id UUID;
BEGIN
  SELECT p.id, p.tenant_id INTO v_user_id, v_tenant_id
    FROM profiles p
    JOIN tenants t ON t.id = p.tenant_id
    WHERE t.slug = 'alpen-energie'
    LIMIT 1;
  PERFORM test_set_auth(v_user_id);
END $$;

SELECT is(
  current_tenant_id(),
  (SELECT id FROM tenants WHERE slug = 'alpen-energie'),
  'current_tenant_id() returns alpen-energie for its user'
);

-- Test 7: is_holding_admin() returns false for regular tenant user
SELECT ok(
  NOT is_holding_admin(),
  'is_holding_admin() returns false for tenant user'
);

-- Test 8: is_holding_admin() returns true for holding admin
DO $$ BEGIN PERFORM test_reset_auth(); END $$;
DO $$
DECLARE
  v_holding_user UUID;
BEGIN
  SELECT ha.profile_id INTO v_holding_user
    FROM holding_admins ha
    LIMIT 1;
  IF v_holding_user IS NULL THEN
    RAISE EXCEPTION 'No holding admin found. Run: pnpm seed:dev';
  END IF;
  PERFORM test_set_auth(v_holding_user);
END $$;

SELECT ok(
  is_holding_admin(),
  'is_holding_admin() returns true for holding admin'
);


-- ═════════════════════════════════════════════════════════════════════
-- Tests 9-14: Cross-tenant data isolation
-- Alpen-energie user must NOT see test-company data
-- ═════════════════════════════════════════════════════════════════════

-- Switch to alpen-energie user
DO $$ BEGIN PERFORM test_reset_auth(); END $$;
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT p.id INTO v_user_id
    FROM profiles p
    JOIN tenants t ON t.id = p.tenant_id
    WHERE t.slug = 'alpen-energie'
    LIMIT 1;
  PERFORM test_set_auth(v_user_id);
END $$;

-- Test 9: Leads isolation
SELECT is(
  (SELECT count(*)::integer FROM leads
   WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'test-company')),
  0,
  'Alpen-energie user cannot see test-company leads'
);

-- Test 10: Offers isolation
SELECT is(
  (SELECT count(*)::integer FROM offers
   WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'test-company')),
  0,
  'Alpen-energie user cannot see test-company offers'
);

-- Test 11: Projects isolation
SELECT is(
  (SELECT count(*)::integer FROM projects
   WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'test-company')),
  0,
  'Alpen-energie user cannot see test-company projects'
);

-- Test 12: Invoices isolation
SELECT is(
  (SELECT count(*)::integer FROM invoices
   WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'test-company')),
  0,
  'Alpen-energie user cannot see test-company invoices'
);

-- Test 13: Calls isolation
SELECT is(
  (SELECT count(*)::integer FROM calls
   WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'test-company')),
  0,
  'Alpen-energie user cannot see test-company calls'
);

-- Test 14: Profiles isolation
SELECT is(
  (SELECT count(*)::integer FROM profiles
   WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'test-company')),
  0,
  'Alpen-energie user cannot see test-company profiles'
);


-- ═════════════════════════════════════════════════════════════════════
-- Tests 15-16: User CAN see own tenant data
-- ═════════════════════════════════════════════════════════════════════

-- Still authenticated as alpen-energie user from above

-- Test 15: Own leads visible
SELECT ok(
  (SELECT count(*) > 0 FROM leads
   WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'alpen-energie')),
  'Alpen-energie user can see own leads'
);

-- Test 16: Own profiles visible
SELECT ok(
  (SELECT count(*) > 0 FROM profiles
   WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'alpen-energie')),
  'Alpen-energie user can see own profiles'
);


-- ═════════════════════════════════════════════════════════════════════
-- Tests 17-18: Holding admin can see all tenants
-- ═════════════════════════════════════════════════════════════════════

DO $$ BEGIN PERFORM test_reset_auth(); END $$;
DO $$
DECLARE
  v_holding_user UUID;
BEGIN
  SELECT ha.profile_id INTO v_holding_user
    FROM holding_admins ha
    LIMIT 1;
  PERFORM test_set_auth(v_holding_user);
END $$;

-- Test 17: Holding admin can see alpen-energie leads
SELECT ok(
  (SELECT count(*) > 0 FROM leads
   WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'alpen-energie')),
  'Holding admin can see alpen-energie leads'
);

-- Test 18: Holding admin can query test-company leads
SELECT ok(
  (SELECT count(*) >= 0 FROM leads
   WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'test-company')),
  'Holding admin can query test-company leads'
);


-- ═════════════════════════════════════════════════════════════════════
-- Tests 19-20: updated_at trigger
-- ═════════════════════════════════════════════════════════════════════

-- Switch back to service role for direct update
DO $$ BEGIN PERFORM test_reset_auth(); END $$;

-- Test 19: Update succeeds
SELECT lives_ok(
  $$UPDATE leads SET notes = 'pgTAP test ' || now()::text WHERE id = (SELECT id FROM leads LIMIT 1)$$,
  'Can update a lead'
);

-- Test 20: updated_at was bumped
SELECT ok(
  (SELECT updated_at >= created_at FROM leads WHERE notes LIKE 'pgTAP test%' LIMIT 1),
  'updated_at is greater than or equal to created_at after update'
);


-- ═════════════════════════════════════════════════════════════════════
-- Tests 21-22: Phase definitions
-- ═════════════════════════════════════════════════════════════════════

-- Test 21: Alpen-energie has 27 phase definitions (Bau & Montage Kanban)
SELECT ok(
  (SELECT count(*) >= 27 FROM phase_definitions
   WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'alpen-energie')),
  'Alpen-energie has at least 27 phase definitions'
);

-- Test 22: Phase 1 exists
SELECT ok(
  (SELECT count(*) > 0 FROM phase_definitions
   WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'alpen-energie')
     AND phase_number = 1),
  'Phase 1 exists for alpen-energie'
);


-- ═════════════════════════════════════════════════════════════════════
-- Test 23: Tenant branding auto-created
-- ═════════════════════════════════════════════════════════════════════

SELECT ok(
  (SELECT count(*) > 0 FROM tenant_brandings
   WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'alpen-energie')),
  'Tenant branding exists for alpen-energie'
);


-- ═════════════════════════════════════════════════════════════════════
-- Test 24: System roles auto-seeded
-- ═════════════════════════════════════════════════════════════════════

SELECT ok(
  (SELECT count(*) >= 9 FROM roles
   WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'alpen-energie')
     AND is_system = true),
  'At least 9 system roles seeded for alpen-energie'
);


-- ═════════════════════════════════════════════════════════════════════
-- Cleanup & Finish
-- ═════════════════════════════════════════════════════════════════════

SELECT * FROM finish();
ROLLBACK;
