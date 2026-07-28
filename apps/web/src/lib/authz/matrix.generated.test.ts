import { describe, it, expect } from 'vitest'
import type { ProfileRow, UserSession } from '@enura/types'
import { ROUTE_RULES, decideAccess, canAccessRoute } from './policy'

/**
 * GENERATED Role×Route authorization matrix (runbook §5.6 / Phase 7).
 *
 * This test iterates EVERY rule in `ROUTE_RULES` (not a hand-maintained list), so
 * a new route can never silently escape coverage — for each rule it asserts the
 * decision for every company role and for the holding/enura tier identities.
 * Expected access is DERIVED from the rule's `anyOf` ∩ the role's seeded
 * permissions, so it tracks the policy rather than restating it.
 *
 * Scope: this proves the POLICY decision (`decideAccess`) for every cell — a
 * denial is proven to return `ok:false` + a redirect target (not merely a hidden
 * nav item). The HTTP-level proof (direct URL → 307/redirect via middleware /
 * enforceModule) is the Playwright e2e, which is environment-gated (needs a
 * running app + Supabase) — see the a11y/e2e note in the run-log.
 */

// Role → permission set. Mirrors packages/types/src/mocks/seed-data.ts `rolePermMap`
// (verified identical). The authorization ground truth for the 9 company roles.
const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_user: [
    'module:setter:read', 'module:setter:write', 'module:setter:export', 'module:setter:admin',
    'module:berater:read', 'module:berater:write', 'module:berater:export', 'module:berater:admin',
    'module:leads:read', 'module:leads:write', 'module:leads:export', 'module:leads:admin',
    'module:innendienst:read', 'module:innendienst:write', 'module:innendienst:export', 'module:innendienst:admin',
    'module:bau:read', 'module:bau:write', 'module:bau:export', 'module:bau:admin',
    'module:finance:read', 'module:finance:write', 'module:finance:export', 'module:finance:admin',
    'module:reports:read', 'module:reports:write', 'module:reports:export', 'module:reports:admin',
    'module:anomalies:read', 'module:finanzplanung:read',
    'module:ai:read', 'module:ai:write', 'module:ai:admin',
    'module:admin:read', 'module:admin:write', 'module:admin:branding', 'module:admin:users', 'module:admin:connectors',
  ],
  // F-P7: reconciled to DB seed (026 + 048). gf = every module:%:read (incl.
  // module:admin:read -> /settings; D2). teamleiter = 4 module reads (no ai:read).
  geschaeftsfuehrung: [
    'module:setter:read', 'module:berater:read', 'module:leads:read',
    'module:innendienst:read', 'module:bau:read', 'module:finance:read',
    'module:reports:read', 'module:ai:read', 'module:admin:read', 'module:anomalies:read',
    'module:finanzplanung:read',
  ],
  teamleiter: [
    'module:setter:read', 'module:berater:read', 'module:leads:read', 'module:reports:read',
  ],
  setter: ['module:setter:read'],
  berater: ['module:berater:read'],
  innendienst: ['module:innendienst:read', 'module:innendienst:write', 'module:bau:read'],
  bau: ['module:bau:read', 'module:bau:write'],
  buchhaltung: ['module:finance:read', 'module:finance:write'],
  leadkontrolle: ['module:leads:read', 'module:leads:write'],
  // Finanzplanung roles (migration 028) — finanzplanung:read gates /finanzplanung;
  // the granular keys gate page-internal actions (not routes).
  validator: ['module:finanzplanung:read', 'module:finanzplanung:validate'],
  invoice_approver: ['module:finanzplanung:read', 'module:finanzplanung:approve_invoice'],
  cashout_planner: ['module:finanzplanung:read', 'module:finanzplanung:plan_cashout', 'module:finanzplanung:export_payment', 'module:finanzplanung:manage_suppliers'],
  financial_approver: ['module:finanzplanung:read', 'module:finanzplanung:approve_payment'],
}
const ROLES = Object.keys(ROLE_PERMISSIONS)

const BASE_PROFILE: ProfileRow = {
  id: 'p-0', company_id: 'c-1', holding_id: null,
  first_name: 'T', last_name: 'U', display_name: 'T U', avatar_url: null, phone: null, locale: 'de-CH',
  must_reset_password: false, password_reset_at: null, totp_enabled: true, totp_enrolled_at: null,
  last_sign_in_at: null, is_active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
}
function makeSession(over: Partial<UserSession>): UserSession {
  return { profile: BASE_PROFILE, holdingId: null, companyId: 'c-1', roles: [], permissions: [], isEnuraAdmin: false, isHoldingAdmin: false, ...over }
}
const companyUser = (role: string) => makeSession({ companyId: 'c-1', permissions: ROLE_PERMISSIONS[role] ?? [] })
const HOLDING_ADMIN = makeSession({ companyId: null, holdingId: 'h-1', isHoldingAdmin: true })
const ENURA_ADMIN = makeSession({ companyId: null, holdingId: null, isEnuraAdmin: true })

function expectedCompanyAccess(anyOf: readonly string[] | undefined, role: string): boolean {
  if (!anyOf || anyOf.length === 0) return true
  const perms = ROLE_PERMISSIONS[role] ?? []
  return anyOf.some((k) => perms.includes(k))
}

describe('GENERATED Role×Route matrix — exhaustive over ROUTE_RULES', () => {
  for (const rule of ROUTE_RULES) {
    if (rule.tier === 'company') {
      for (const role of ROLES) {
        const expected = expectedCompanyAccess(rule.anyOf, role)
        it(`company:${role} ${expected ? 'CAN' : 'cannot'} access ${rule.prefix}`, () => {
          const session = companyUser(role)
          expect(canAccessRoute(session, rule.prefix)).toBe(expected)
          if (!expected) {
            const d = decideAccess(session, rule.prefix)
            expect(d.ok).toBe(false)
            // denial is a real redirect, not a silently-hidden link
            if (!d.ok) expect(typeof d.redirectTo).toBe('string')
          }
        })
      }
      it(`company route ${rule.prefix} is denied to holding & enura admins (cross-tier)`, () => {
        expect(canAccessRoute(HOLDING_ADMIN, rule.prefix)).toBe(false)
        expect(canAccessRoute(ENURA_ADMIN, rule.prefix)).toBe(false)
      })
    } else if (rule.tier === 'enura') {
      it(`enura route ${rule.prefix}: ONLY enura admin (not holding, not any company role)`, () => {
        expect(canAccessRoute(ENURA_ADMIN, rule.prefix)).toBe(true)
        expect(canAccessRoute(HOLDING_ADMIN, rule.prefix)).toBe(false)
        expect(canAccessRoute(companyUser('super_user'), rule.prefix)).toBe(false)
      })
    } else {
      it(`holding route ${rule.prefix}: ONLY holding admin (not enura, not any company role)`, () => {
        expect(canAccessRoute(HOLDING_ADMIN, rule.prefix)).toBe(true)
        expect(canAccessRoute(ENURA_ADMIN, rule.prefix)).toBe(false)
        expect(canAccessRoute(companyUser('super_user'), rule.prefix)).toBe(false)
      })
    }
  }
})

describe('matrix coverage guard', () => {
  it('every ROUTE_RULES entry has a known tier (company|holding|enura)', () => {
    for (const rule of ROUTE_RULES) {
      expect(['company', 'holding', 'enura']).toContain(rule.tier)
    }
  })
  it('the three tiers are all represented in the route table', () => {
    const tiers = new Set(ROUTE_RULES.map((r) => r.tier))
    expect(tiers.has('company')).toBe(true)
    expect(tiers.has('holding')).toBe(true)
    expect(tiers.has('enura')).toBe(true)
  })
  it('canonical adversarial probes (runbook §6.3)', () => {
    // setter cannot load /finance by URL
    expect(canAccessRoute(companyUser('setter'), '/finance')).toBe(false)
    // company super_user cannot reach /admin or /platform
    expect(canAccessRoute(companyUser('super_user'), '/admin')).toBe(false)
    expect(canAccessRoute(companyUser('super_user'), '/platform')).toBe(false)
    // holding admin does not see enura surfaces
    expect(canAccessRoute(HOLDING_ADMIN, '/platform')).toBe(false)
    expect(canAccessRoute(HOLDING_ADMIN, '/platform/addons')).toBe(false)
    // pure enura admin cannot reach /admin/secrets
    expect(canAccessRoute(ENURA_ADMIN, '/admin/secrets')).toBe(false)
  })
})
