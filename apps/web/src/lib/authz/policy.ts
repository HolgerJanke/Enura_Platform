/**
 * Authorization policy — the SINGLE SOURCE OF TRUTH for who may enter which tier
 * and reach which route. Both server-side enforcement (`./enforce.ts`) and
 * navigation rendering consume this module, so "visible ⇔ accessible" holds by
 * construction (runbook §5.4/§5.5).
 *
 * This file is deliberately PURE: no `next/navigation`, no `getSession`, no I/O.
 * Everything here is a synchronous function of a `UserSession` (or a plain
 * permission set), which makes the whole policy unit-testable without a Next.js
 * runtime. Side-effecting enforcement lives in `./enforce.ts`.
 *
 * Key spaces (see runbook §5.3):
 *  - Module RBAC keys `module:{name}:{action}` — back `session.permissions`; the
 *    primary route/module gate for Company-tier users.
 *  - Holding capability keys (dot-separated, e.g. `process.deploy`) — governed by
 *    the per-holding `permission_matrix` ceiling (OD-3). Modelled here; the actual
 *    matrix read is wired in Phase 6.
 */

import type { UserSession } from '@enura/types'

// ---------------------------------------------------------------------------
// Tiers
// ---------------------------------------------------------------------------

/** The three hierarchy tiers (runbook §5.1). */
export type Tier = 'enura' | 'holding' | 'company'

export const MODULE_ACTIONS = ['read', 'write', 'export', 'admin'] as const
export type ModuleAction = (typeof MODULE_ACTIONS)[number]

/**
 * The tiers a session may enter. A session can legitimately hold more than one
 * capability (e.g. an Enura admin who also has a company context), so this
 * returns a set rather than a single tier.
 *
 * Per OD-1 (honor CLAUDE.md §7): tier flags are the sole basis for tier entry.
 * Per OD-2: the Holding tier is entered by `isHoldingAdmin` ONLY — Enura admins
 * do NOT implicitly gain Holding entry (Enura-only surfaces live under /platform).
 */
export function sessionTiers(session: UserSession): ReadonlySet<Tier> {
  const tiers = new Set<Tier>()
  if (session.isEnuraAdmin) tiers.add('enura')
  if (session.isHoldingAdmin) tiers.add('holding')
  // OD-1 / CLAUDE.md §7 invariant: a holding/enura admin is NOT a Company user.
  // Even if a stray company_id is present on the profile (e.g. the "New Holding"
  // onboarding flow historically set one alongside holding_admins + a super_user
  // role — finding F-P2), an admin session never gains Company-tier access here.
  // The sanctioned path for an admin to act inside a tenant is impersonation,
  // which mints a real, non-admin company session. Company tier therefore requires
  // a companyId AND the absence of any admin flag — defense-in-depth so bad data
  // upstream cannot become a cross-tier privilege escalation.
  const isAdmin = session.isEnuraAdmin || session.isHoldingAdmin
  if (session.companyId && !isAdmin) tiers.add('company')
  return tiers
}

/** Whether the session may enter the given tier at all (route-independent). */
export function canEnterTier(session: UserSession, tier: Tier): boolean {
  return sessionTiers(session).has(tier)
}

// ---------------------------------------------------------------------------
// Module permissions (Company-tier RBAC)
// ---------------------------------------------------------------------------

/**
 * Does the session hold a given module permission key?
 *
 * NOTE (behaviour vs. legacy `lib/permissions.ts`): this does NOT auto-grant to
 * holding/enura admins. Under OD-1 a holding/enura admin is not a Company user;
 * Company module access is decided purely by the user's own granted permissions
 * (a tenant `super_user` holds every `module:*` key via seed). Cross-tier admins
 * reach their own tiers via `canEnterTier`, not by overriding company RBAC. This
 * function is additive in Phase 1 (no existing call site uses it yet); call sites
 * switch to it in Phase 3.
 */
export function hasModulePermission(session: UserSession, key: string): boolean {
  return session.permissions.includes(key)
}

// ---------------------------------------------------------------------------
// Holding capability ceiling (OD-3 — modelled here, wired in Phase 6)
// ---------------------------------------------------------------------------

/**
 * Capability keys that are platform-locked (always ON) and cannot be disabled by
 * a holding admin. Mirrors `PLATFORM_LOCKS` in the permissions admin action.
 */
export const PLATFORM_LOCKED_CAPABILITIES: ReadonlySet<string> = new Set([
  'audit_log.read',
  'audit_log.export',
  'data_residency.enforce',
  'totp.require',
  'rls.enforce',
])

/**
 * Is a holding capability allowed under a given holding `permission_matrix`?
 *
 * The matrix is a CEILING, not a grant (runbook §5.3): a capability is allowed
 * unless the holding explicitly disabled it. Platform-locked keys are always
 * allowed. `matrix` is `holdings.permission_matrix` (`Record<string, boolean>`);
 * a missing/undefined matrix imposes no additional restriction (default-allow),
 * which is exactly today's behaviour — so introducing this is non-breaking.
 */
export function isCapabilityAllowed(
  key: string,
  matrix?: Record<string, boolean> | null,
): boolean {
  if (PLATFORM_LOCKED_CAPABILITIES.has(key)) return true
  if (!matrix) return true
  return matrix[key] ?? true
}

// ---------------------------------------------------------------------------
// Route policy
// ---------------------------------------------------------------------------

export interface RouteRule {
  /** URL path prefix this rule governs (longest-prefix wins). */
  prefix: string
  /** Which tier owns this route. */
  tier: Tier
  /**
   * For Company-tier routes: the module permission keys that grant access
   * (ANY-of). An empty/omitted list means "any authenticated Company user".
   * Ignored for enura/holding tiers, whose entry is the tier flag itself.
   */
  anyOf?: string[]
  /** Human note for maintainers / the generated matrix test. */
  note?: string
}

/**
 * Paths reachable without a session / tier (auth funnel + public info + help).
 * Kept in sync with middleware `PUBLIC_PATHS`. NOTE: `/debug` is intentionally
 * NOT public here — its public exposure is a Phase-2 security fix (finding C3).
 */
export const PUBLIC_PREFIXES: readonly string[] = [
  '/login',
  '/reset-password',
  '/enrol-2fa',
  '/verify-2fa',
  '/invite',
  '/privacy',
  '/help',
]

/**
 * The route table. Order does not matter; resolution is by LONGEST matching
 * prefix, so `/settings/users` beats `/settings`. Company-route → permission
 * mappings follow CLAUDE.md §7's "Permission Check Pattern" and are a faithful
 * function of the seeded grants (see runbook §5.6 and finding F-P1 for the
 * `/leads` / `/anomalies` cells flagged for later review).
 */
export const ROUTE_RULES: readonly RouteRule[] = [
  // --- Enura Group tier ---
  { prefix: '/platform', tier: 'enura' },

  // --- Holding tier ---
  { prefix: '/admin', tier: 'holding' },

  // --- Company tier: settings are super_user-only (only super_user is seeded
  //     the module:admin:* keys) ---
  { prefix: '/settings/users', tier: 'company', anyOf: ['module:admin:users'] },
  { prefix: '/settings/branding', tier: 'company', anyOf: ['module:admin:branding'] },
  { prefix: '/settings/connectors', tier: 'company', anyOf: ['module:admin:connectors'] },
  { prefix: '/settings', tier: 'company', anyOf: ['module:admin:read'], note: 'call-script, reports, misc super_user settings' },

  // --- Company tier: BI modules ---
  { prefix: '/setter', tier: 'company', anyOf: ['module:setter:read'] },
  { prefix: '/berater', tier: 'company', anyOf: ['module:berater:read'] },
  { prefix: '/leads', tier: 'company', anyOf: ['module:leads:read'], note: 'Lead Control: leadkontrolle + management (setter/berater/innendienst do NOT hold leads:read per DB seed 026)' },
  { prefix: '/innendienst', tier: 'company', anyOf: ['module:innendienst:read'] },
  { prefix: '/projects', tier: 'company', anyOf: ['module:bau:read'], note: 'Bau & Montage 27-phase' },
  { prefix: '/finance', tier: 'company', anyOf: ['module:finance:read'] },
  { prefix: '/cashflow-gantt', tier: 'company', anyOf: ['module:finance:read'] },
  { prefix: '/liquidity', tier: 'company', anyOf: ['module:finance:read'] },
  { prefix: '/finanzplanung', tier: 'company', anyOf: ['module:finance:read'] },
  { prefix: '/controlling', tier: 'company', anyOf: ['module:finance:read'] },
  { prefix: '/reports', tier: 'company', anyOf: ['module:reports:read'] },
  { prefix: '/analytics', tier: 'company', anyOf: ['module:reports:read'] },
  { prefix: '/anomalies', tier: 'company', anyOf: ['module:anomalies:read'], note: 'F-P1: management-only (super_user + geschaeftsfuehrung). Dedicated key so teamleiter — who holds reports:read for /reports — is excluded here. gf auto-holds it via the seed module:%:read pattern; teamleiter does not. Migration 048.' },

  // --- Company tier: shared surfaces available to any authenticated company user ---
  { prefix: '/processes', tier: 'company', note: 'Process House; per-process visible_roles enforced separately' },
  { prefix: '/dashboard', tier: 'company', note: 'home' },
]

/** Resolve the governing rule for a pathname (longest-prefix match), or null. */
export function matchRouteRule(pathname: string): RouteRule | null {
  let best: RouteRule | null = null
  for (const rule of ROUTE_RULES) {
    if (pathname === rule.prefix || pathname.startsWith(rule.prefix + '/')) {
      if (!best || rule.prefix.length > best.prefix.length) best = rule
    }
  }
  return best
}

/** Is this path public (no session/tier required)? */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  )
}

// ---------------------------------------------------------------------------
// The access decision
// ---------------------------------------------------------------------------

export type AccessDecision =
  | { ok: true }
  | { ok: false; reason: 'unauthenticated' | 'wrong-tier' | 'missing-permission' | 'unknown-route'; redirectTo: string }

/**
 * The single access decision consumed by enforcement AND nav. Pure.
 *
 * `session` is null for an unauthenticated request. `pathname` is the target
 * path. Returns `{ ok: true }` or a denial with the tier-appropriate redirect
 * target (real redirects replace today's inert 200 denial pages — finding C4).
 */
export function decideAccess(
  session: UserSession | null,
  pathname: string,
): AccessDecision {
  if (isPublicPath(pathname)) return { ok: true }

  if (!session) {
    return { ok: false, reason: 'unauthenticated', redirectTo: '/login' }
  }

  const rule = matchRouteRule(pathname)
  if (!rule) {
    // Unknown/unmapped authenticated path: default-deny to the user's home tier.
    return { ok: false, reason: 'unknown-route', redirectTo: homeFor(session) }
  }

  if (!canEnterTier(session, rule.tier)) {
    return { ok: false, reason: 'wrong-tier', redirectTo: homeFor(session) }
  }

  // Tier entry satisfied. Company routes additionally require a module permission.
  if (rule.tier === 'company' && rule.anyOf && rule.anyOf.length > 0) {
    const allowed = rule.anyOf.some((k) => hasModulePermission(session, k))
    if (!allowed) {
      return { ok: false, reason: 'missing-permission', redirectTo: homeFor(session) }
    }
  }

  return { ok: true }
}

/** Convenience boolean form for nav rendering. */
export function canAccessRoute(session: UserSession | null, pathname: string): boolean {
  return decideAccess(session, pathname).ok
}

/** The minimal set of flags needed to compute tier membership / home surface. */
export interface TierFlags {
  isEnuraAdmin: boolean
  isHoldingAdmin: boolean
  companyId: string | null
}

/**
 * Home surface from raw tier flags. Shared by the full-session `homeFor` and by
 * the edge middleware (which knows the flags but not the full `UserSession`), so
 * both agree on where a denied user is sent. Honors the OD-1 invariant: an admin
 * (holding/enura) is not a Company user, so a stray `companyId` never routes an
 * admin to the tenant dashboard.
 */
export function homeForFlags(f: TierFlags): string {
  const isAdmin = f.isEnuraAdmin || f.isHoldingAdmin
  if (!isAdmin && f.companyId) return '/dashboard'
  if (f.isHoldingAdmin) return '/admin'
  if (f.isEnuraAdmin) return '/platform'
  return '/login'
}

/**
 * Where to send a user who lacks access to the requested path: their own
 * home surface, chosen by the highest tier they can enter. An authenticated
 * user with no tier at all is bounced to /login.
 */
export function homeFor(session: UserSession | null): string {
  if (!session) return '/login'
  return homeForFlags({
    isEnuraAdmin: session.isEnuraAdmin,
    isHoldingAdmin: session.isHoldingAdmin,
    companyId: session.companyId,
  })
}
