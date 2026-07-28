import { describe, it, expect } from 'vitest'
import type { ProfileRow, UserSession } from '@enura/types'
import {
  decideAccess,
  canAccessRoute,
  canEnterTier,
  sessionTiers,
  matchRouteRule,
  isPublicPath,
  homeFor,
  homeForFlags,
  isCapabilityAllowed,
  hasModulePermission,
} from './policy'

// ---------------------------------------------------------------------------
// Fixtures — role→permission sets copied verbatim from the seed
// (packages/types/src/mocks/seed-data.ts `rolePermMap`). If the seed changes,
// this map must change with it; the Phase-7 generated test derives from the seed
// directly, this hand-written one pins the expected behaviour.
// ---------------------------------------------------------------------------

const ROLE_PERMS: Record<string, string[]> = {
  super_user: [
    'module:setter:read', 'module:setter:write', 'module:setter:export', 'module:setter:admin',
    'module:berater:read', 'module:berater:write', 'module:berater:export', 'module:berater:admin',
    'module:leads:read', 'module:leads:write', 'module:leads:export', 'module:leads:admin',
    'module:innendienst:read', 'module:innendienst:write', 'module:innendienst:export', 'module:innendienst:admin',
    'module:bau:read', 'module:bau:write', 'module:bau:export', 'module:bau:admin',
    'module:finance:read', 'module:finance:write', 'module:finance:export', 'module:finance:admin',
    'module:reports:read', 'module:reports:write', 'module:reports:export', 'module:reports:admin',
    'module:anomalies:read', 'module:finanzplanung:read',
    'module:finanzplanung:review_bank_data', 'module:finanzplanung:approve_bank_data',
    'module:ai:read', 'module:ai:write', 'module:ai:admin',
    'module:admin:read', 'module:admin:write', 'module:admin:branding', 'module:admin:users', 'module:admin:connectors',
  ],
  // F-P7: reconciled to the authoritative DB seed (026 + 048). gf is seeded EVERY
  // module:%:read (reads only) — which sweeps in module:admin:read, so gf reaches
  // /settings/call-script + /settings/reports (D2: operator accepted the DB). No
  // writes/exports. teamleiter is reads on 4 modules only (no ai:read in the DB).
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
  // buchhaltung = Finanzplanung "Planer" (architecture.md §8) — migration 050.
  buchhaltung: ['module:finance:read', 'module:finance:write', 'module:finanzplanung:read', 'module:finanzplanung:plan_cashout', 'module:finanzplanung:export_payment', 'module:finanzplanung:manage_suppliers'],
  leadkontrolle: ['module:leads:read', 'module:leads:write'],
  // Finanzplanung roles (migration 028 + 050). validator reviews / financial_approver approves bank data.
  validator: ['module:finanzplanung:read', 'module:finanzplanung:validate', 'module:finanzplanung:review_bank_data'],
  invoice_approver: ['module:finanzplanung:read', 'module:finanzplanung:approve_invoice'],
  cashout_planner: ['module:finanzplanung:read', 'module:finanzplanung:plan_cashout', 'module:finanzplanung:export_payment', 'module:finanzplanung:manage_suppliers'],
  financial_approver: ['module:finanzplanung:read', 'module:finanzplanung:approve_payment', 'module:finanzplanung:approve_bank_data'],
}

const BASE_PROFILE: ProfileRow = {
  id: 'p-0', company_id: 'c-1', holding_id: null,
  first_name: 'Test', last_name: 'User', display_name: 'Test User',
  avatar_url: null, phone: null, locale: 'de-CH',
  must_reset_password: false, password_reset_at: null,
  totp_enabled: true, totp_enrolled_at: null, last_sign_in_at: null,
  is_active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
}

function makeSession(over: Partial<UserSession> = {}): UserSession {
  return {
    profile: BASE_PROFILE,
    holdingId: null,
    companyId: 'c-1',
    roles: [],
    permissions: [],
    isEnuraAdmin: false,
    isHoldingAdmin: false,
    ...over,
  }
}

/** A Company-tier user with the given role's seeded permissions. */
function companyUser(roleKey: string): UserSession {
  return makeSession({ companyId: 'c-1', permissions: ROLE_PERMS[roleKey] })
}

const HOLDING_ADMIN = makeSession({ companyId: null, holdingId: 'h-1', isHoldingAdmin: true })
const ENURA_ADMIN = makeSession({ companyId: null, holdingId: null, isEnuraAdmin: true })

/**
 * The §7-violating dual-identity shape the "New Holding" onboarding flow can
 * produce (finding F-P2): a holding admin whose profile ALSO carries a company_id
 * and a full super_user permission set. The policy must NOT grant Company-tier
 * access to such a session (OD-1 / CLAUDE.md §7).
 */
const DUAL_IDENTITY_ADMIN = makeSession({
  companyId: 'c-1',
  holdingId: 'h-1',
  isHoldingAdmin: true,
  permissions: ROLE_PERMS.super_user,
})

// ---------------------------------------------------------------------------
// Tier membership (OD-1 / OD-2)
// ---------------------------------------------------------------------------

describe('tier membership', () => {
  it('company user is only in the company tier', () => {
    const s = companyUser('setter')
    expect([...sessionTiers(s)]).toEqual(['company'])
    expect(canEnterTier(s, 'holding')).toBe(false)
    expect(canEnterTier(s, 'enura')).toBe(false)
  })

  it('holding admin is in holding tier only (OD-2: NOT enura)', () => {
    expect([...sessionTiers(HOLDING_ADMIN)]).toEqual(['holding'])
    expect(canEnterTier(HOLDING_ADMIN, 'enura')).toBe(false)
    expect(canEnterTier(HOLDING_ADMIN, 'company')).toBe(false)
  })

  it('enura admin is in enura tier only (OD-2: does NOT implicitly get holding)', () => {
    expect([...sessionTiers(ENURA_ADMIN)]).toEqual(['enura'])
    expect(canEnterTier(ENURA_ADMIN, 'holding')).toBe(false)
  })

  it('F-P2: a dual-identity admin (stray company_id + super_user perms) is NOT a company user', () => {
    // The exact escalation shape the "New Holding" onboarding produces.
    expect([...sessionTiers(DUAL_IDENTITY_ADMIN)]).toEqual(['holding'])
    expect(canEnterTier(DUAL_IDENTITY_ADMIN, 'company')).toBe(false)
    // Despite holding every module:* key, company routes are denied and the user
    // is routed to the holding console, not the tenant dashboard.
    expect(decideAccess(DUAL_IDENTITY_ADMIN, '/dashboard')).toMatchObject({ ok: false, reason: 'wrong-tier', redirectTo: '/admin' })
    expect(decideAccess(DUAL_IDENTITY_ADMIN, '/finance')).toMatchObject({ ok: false, reason: 'wrong-tier', redirectTo: '/admin' })
    expect(decideAccess(DUAL_IDENTITY_ADMIN, '/settings/users')).toMatchObject({ ok: false, reason: 'wrong-tier', redirectTo: '/admin' })
    expect(decideAccess(DUAL_IDENTITY_ADMIN, '/processes')).toMatchObject({ ok: false, reason: 'wrong-tier', redirectTo: '/admin' })
    expect(homeFor(DUAL_IDENTITY_ADMIN)).toBe('/admin')
  })

  it('an authenticated session with NO tier at all is denied everything → /login', () => {
    const noTier = makeSession({ companyId: null, holdingId: null })
    expect([...sessionTiers(noTier)]).toEqual([])
    expect(decideAccess(noTier, '/dashboard')).toMatchObject({ ok: false, reason: 'wrong-tier', redirectTo: '/login' })
    expect(homeFor(noTier)).toBe('/login')
  })
})

// ---------------------------------------------------------------------------
// Route resolution
// ---------------------------------------------------------------------------

describe('matchRouteRule (longest prefix)', () => {
  it('resolves /settings/users to the users rule, not /settings', () => {
    expect(matchRouteRule('/settings/users')?.anyOf).toEqual(['module:admin:users'])
    expect(matchRouteRule('/settings/call-script')?.anyOf).toEqual(['module:admin:read'])
  })
  it('maps tiers correctly', () => {
    expect(matchRouteRule('/platform/holdings/new')?.tier).toBe('enura')
    expect(matchRouteRule('/admin/secrets')?.tier).toBe('holding')
    expect(matchRouteRule('/finance')?.tier).toBe('company')
  })
  it('returns null for an unmapped path', () => {
    expect(matchRouteRule('/totally-unknown')).toBeNull()
  })
})

describe('public paths', () => {
  it('login/reset/2fa/help/privacy/invite are public', () => {
    for (const p of ['/login', '/reset-password', '/enrol-2fa', '/verify-2fa', '/help', '/help/holding/x', '/privacy', '/invite/abc']) {
      expect(isPublicPath(p)).toBe(true)
    }
  })
  it('/debug is NOT public (C3 fix territory)', () => {
    expect(isPublicPath('/debug')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// The Role×Route matrix — the heart of the policy (runbook §5.6)
// ---------------------------------------------------------------------------

// route → set of role keys that SHOULD be granted (derived from ROLE_PERMS)
const EXPECTED: Record<string, string[]> = {
  '/dashboard': ['super_user', 'geschaeftsfuehrung', 'teamleiter', 'setter', 'berater', 'innendienst', 'bau', 'buchhaltung', 'leadkontrolle', 'validator', 'invoice_approver', 'cashout_planner', 'financial_approver'],
  '/setter': ['super_user', 'geschaeftsfuehrung', 'teamleiter', 'setter'],
  '/berater': ['super_user', 'geschaeftsfuehrung', 'teamleiter', 'berater'],
  '/leads': ['super_user', 'geschaeftsfuehrung', 'teamleiter', 'leadkontrolle'],
  '/innendienst': ['super_user', 'geschaeftsfuehrung', 'innendienst'],
  '/projects': ['super_user', 'geschaeftsfuehrung', 'innendienst', 'bau'],
  '/finance': ['super_user', 'geschaeftsfuehrung', 'buchhaltung'],
  '/finanzplanung': ['super_user', 'geschaeftsfuehrung', 'buchhaltung', 'validator', 'invoice_approver', 'cashout_planner', 'financial_approver'],
  '/cashflow-gantt': ['super_user', 'geschaeftsfuehrung', 'buchhaltung'],
  '/liquidity': ['super_user', 'geschaeftsfuehrung', 'buchhaltung'],
  '/controlling': ['super_user', 'geschaeftsfuehrung', 'buchhaltung'],
  '/reports': ['super_user', 'geschaeftsfuehrung', 'teamleiter'],
  '/anomalies': ['super_user', 'geschaeftsfuehrung'],
  '/analytics': ['super_user', 'geschaeftsfuehrung', 'teamleiter'],
  '/settings': ['super_user', 'geschaeftsfuehrung'], // D2: gf holds admin:read via the seed module:%:read pattern
  '/settings/users': ['super_user'],
  '/settings/branding': ['super_user'],
  '/settings/connectors': ['super_user'],
  // /processes and /dashboard have no anyOf → any authenticated company user
  '/processes': ['super_user', 'geschaeftsfuehrung', 'teamleiter', 'setter', 'berater', 'innendienst', 'bau', 'buchhaltung', 'leadkontrolle', 'validator', 'invoice_approver', 'cashout_planner', 'financial_approver'],
}

const ALL_ROLES = Object.keys(ROLE_PERMS)

describe('Role×Route matrix (company tier)', () => {
  for (const [route, allowed] of Object.entries(EXPECTED)) {
    for (const role of ALL_ROLES) {
      const shouldAllow = allowed.includes(role)
      it(`${role} ${shouldAllow ? 'CAN' : 'cannot'} access ${route}`, () => {
        expect(canAccessRoute(companyUser(role), route)).toBe(shouldAllow)
      })
    }
  }
})

// ---------------------------------------------------------------------------
// Cross-tier denials (the adversarial probes named in runbook §6)
// ---------------------------------------------------------------------------

describe('cross-tier denials', () => {
  it('a setter cannot load /finance by URL', () => {
    const d = decideAccess(companyUser('setter'), '/finance')
    expect(d.ok).toBe(false)
    if (!d.ok) { expect(d.reason).toBe('missing-permission'); expect(d.redirectTo).toBe('/dashboard') }
  })
  it('a company user cannot reach /admin or /platform', () => {
    const s = companyUser('super_user')
    expect(decideAccess(s, '/admin').ok).toBe(false)
    expect(decideAccess(s, '/platform').ok).toBe(false)
    expect(decideAccess(s, '/admin/secrets')).toMatchObject({ ok: false, reason: 'wrong-tier', redirectTo: '/dashboard' })
  })
  it('a holding admin can reach /admin but NOT /platform (OD-2)', () => {
    expect(decideAccess(HOLDING_ADMIN, '/admin').ok).toBe(true)
    expect(decideAccess(HOLDING_ADMIN, '/admin/secrets').ok).toBe(true)
    expect(decideAccess(HOLDING_ADMIN, '/platform')).toMatchObject({ ok: false, reason: 'wrong-tier', redirectTo: '/admin' })
  })
  it('an enura admin can reach /platform but NOT /admin (OD-2)', () => {
    expect(decideAccess(ENURA_ADMIN, '/platform').ok).toBe(true)
    expect(decideAccess(ENURA_ADMIN, '/admin')).toMatchObject({ ok: false, reason: 'wrong-tier', redirectTo: '/platform' })
  })
})

// ---------------------------------------------------------------------------
// Unauthenticated + unknown routes
// ---------------------------------------------------------------------------

describe('unauthenticated & unknown', () => {
  it('unauthenticated → /login for any protected path', () => {
    expect(decideAccess(null, '/finance')).toMatchObject({ ok: false, reason: 'unauthenticated', redirectTo: '/login' })
    expect(decideAccess(null, '/admin').ok).toBe(false)
  })
  it('unauthenticated → ok for public paths', () => {
    expect(decideAccess(null, '/login').ok).toBe(true)
    expect(decideAccess(null, '/help').ok).toBe(true)
  })
  it('authenticated unknown route → default-deny to home', () => {
    expect(decideAccess(companyUser('bau'), '/totally-unknown')).toMatchObject({ ok: false, reason: 'unknown-route', redirectTo: '/dashboard' })
  })
})

describe('homeFor', () => {
  it('maps to the highest tier surface', () => {
    expect(homeFor(companyUser('setter'))).toBe('/dashboard')
    expect(homeFor(HOLDING_ADMIN)).toBe('/admin')
    expect(homeFor(ENURA_ADMIN)).toBe('/platform')
    expect(homeFor(null)).toBe('/login')
  })
  it('dual-identity admin (F-P2) goes to /admin, not /dashboard', () => {
    expect(homeFor(DUAL_IDENTITY_ADMIN)).toBe('/admin')
  })
})

describe('homeForFlags (edge/middleware form, must agree with homeFor)', () => {
  it('non-admin company user → /dashboard', () => {
    expect(homeForFlags({ isEnuraAdmin: false, isHoldingAdmin: false, companyId: 'c-1' })).toBe('/dashboard')
  })
  it('holding admin → /admin (even with stray companyId, OD-1)', () => {
    expect(homeForFlags({ isEnuraAdmin: false, isHoldingAdmin: true, companyId: null })).toBe('/admin')
    expect(homeForFlags({ isEnuraAdmin: false, isHoldingAdmin: true, companyId: 'c-1' })).toBe('/admin')
  })
  it('enura admin → /platform', () => {
    expect(homeForFlags({ isEnuraAdmin: true, isHoldingAdmin: false, companyId: null })).toBe('/platform')
  })
  it('dual enura+holding → /admin (holding wins for a landing surface)', () => {
    expect(homeForFlags({ isEnuraAdmin: true, isHoldingAdmin: true, companyId: null })).toBe('/admin')
  })
  it('no tier → /login', () => {
    expect(homeForFlags({ isEnuraAdmin: false, isHoldingAdmin: false, companyId: null })).toBe('/login')
  })
})

// ---------------------------------------------------------------------------
// Holding capability ceiling (OD-3 — modelled; wired in Phase 6)
// ---------------------------------------------------------------------------

describe('isCapabilityAllowed (holding matrix ceiling)', () => {
  it('default-allows when no matrix present (non-breaking)', () => {
    expect(isCapabilityAllowed('process.deploy', undefined)).toBe(true)
    expect(isCapabilityAllowed('process.deploy', null)).toBe(true)
  })
  it('respects an explicit disable', () => {
    expect(isCapabilityAllowed('process.deploy', { 'process.deploy': false })).toBe(false)
    expect(isCapabilityAllowed('process.deploy', { 'process.deploy': true })).toBe(true)
  })
  it('platform-locked capabilities are always allowed, even if disabled in the matrix', () => {
    expect(isCapabilityAllowed('rls.enforce', { 'rls.enforce': false })).toBe(true)
    expect(isCapabilityAllowed('audit_log.read', { 'audit_log.read': false })).toBe(true)
  })
  it('unknown key defaults to allowed', () => {
    expect(isCapabilityAllowed('nonexistent.key', {})).toBe(true)
  })

  // OD-3 wire-up: the exact capability keys enforced at action sites. Proves a
  // holding matrix toggle changes a tenant super_user's server-side authorization
  // in BOTH directions (the wired sites call checkCapability → isCapabilityAllowed).
  it('OD-3 wired key process.version: holding can disable editorial process editing', () => {
    // No matrix / not disabled → super_user may edit (RBAC baseline preserved).
    expect(isCapabilityAllowed('process.version', null)).toBe(true)
    expect(isCapabilityAllowed('process.version', {})).toBe(true)
    // Holding disabled it → denied even for a super_user with module:admin:* RBAC.
    expect(isCapabilityAllowed('process.version', { 'process.version': false })).toBe(false)
    // Re-enabled → allowed again.
    expect(isCapabilityAllowed('process.version', { 'process.version': true })).toBe(true)
  })
  it('OD-3: other governed capabilities honor the same ceiling', () => {
    expect(isCapabilityAllowed('connector.credentials', { 'connector.credentials': false })).toBe(false)
    expect(isCapabilityAllowed('user.impersonate', { 'user.impersonate': false })).toBe(false)
    expect(isCapabilityAllowed('connector.credentials', {})).toBe(true)
  })
})

describe('hasModulePermission (no admin auto-grant under OD-1)', () => {
  it('is a pure membership test, no holding/enura override', () => {
    expect(hasModulePermission(HOLDING_ADMIN, 'module:finance:read')).toBe(false)
    expect(hasModulePermission(ENURA_ADMIN, 'module:finance:read')).toBe(false)
    expect(hasModulePermission(companyUser('buchhaltung'), 'module:finance:read')).toBe(true)
  })
})
