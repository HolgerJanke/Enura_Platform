/**
 * Single source of truth for the sidebar navigation of the three shells
 * (Enura /platform, Holding /admin, Company (dashboard)). Every item's
 * visibility is a pure function of the authz policy (`../authz/policy.ts`),
 * so "visible ⇔ accessible" holds by construction — nav is a UX affordance,
 * NOT a security boundary. The real gate remains middleware + per-page
 * `enforceModule` / the tier layouts' own entry checks; this module never
 * grants or denies access, it only decides what to *show*.
 *
 * Each item is exactly one of:
 *  - `always: true`      — no access check (public links, or an item that is
 *                           deliberately exempted from policy-based hiding —
 *                           see the NOTE on 'Add-ons' below).
 *  - `permission: <key>` — shown iff `hasModulePermission(session, key)`.
 *  - `tier: <Tier>`      — shown iff `canEnterTier(session, tier)`. Used for
 *                           items whose target route's only gate is tier
 *                           entry (no module permission involved).
 *  - neither             — shown iff `canAccessRoute(session, href)`, i.e.
 *                           deferred entirely to the route table
 *                           (`ROUTE_RULES` in policy.ts).
 */

import type { UserSession } from '@enura/types'
import { canAccessRoute, canEnterTier, hasModulePermission, type Tier } from '@/lib/authz/policy'

export interface NavItemConfig {
  readonly label: string
  readonly href: string
  readonly icon?: string
  readonly permission?: string
  readonly tier?: Tier
  readonly always?: boolean
}

// ---------------------------------------------------------------------------
// Enura Group tier — /platform shell
// ---------------------------------------------------------------------------

/**
 * NOTE on '← Dashboard': encoded as a plain href item (no `always`/`tier`),
 * so its visibility now comes straight from
 * `canAccessRoute(session, '/dashboard')`. Every session reaching the
 * /platform shell has `isEnuraAdmin === true`, and per OD-1
 * (`sessionTiers` in policy.ts) an admin session never gains Company tier —
 * even with a stray `companyId` — so this item now never shows for anyone
 * in this shell. That is a deliberate correction, not a regression: the
 * previous logic showed it whenever `session.companyId` was truthy, but per
 * that same OD-1 rule the link could never actually lead anywhere but back
 * to /platform (the (dashboard) layout's own company-tier gate would bounce
 * it straight back). Flagged for confirmation — see task report.
 *
 * NOTE on 'Add-ons': marked `always: true` per explicit instruction. Its
 * real route ('/admin/settings/addons') is Holding-tier in `ROUTE_RULES`,
 * which is not yet the right gate for an Enura admin — that reconciliation
 * is Phase 5's job (alongside `EnuraAdminBar`). Do not "fix" it here.
 */
export const PLATFORM_NAV: readonly NavItemConfig[] = [
  { label: '← Dashboard', href: '/dashboard', icon: 'arrow-left' },
  { label: 'Übersicht', href: '/platform', icon: 'overview', tier: 'enura' },
  { label: 'Neue Holding', href: '/platform/holdings/new', icon: 'building', tier: 'enura' },
  { label: 'Add-ons', href: '/admin/settings/addons', icon: 'puzzle', always: true },
  { label: 'Gesundheit', href: '/platform/health', icon: 'health', tier: 'enura' },
  { label: 'Audit', href: '/platform/audit', icon: 'audit', tier: 'enura' },
]

// ---------------------------------------------------------------------------
// Holding tier — /admin shell
// ---------------------------------------------------------------------------

/**
 * NOTE on '← Dashboard → /platform': only relevant to a session that is ALSO
 * an Enura admin (an Enura admin visiting the Holding console via /admin
 * still belongs, at the top, to /platform). Encoded via `tier: 'enura'`
 * rather than `href`, which reproduces the original `session.isEnuraAdmin`
 * check exactly, since `canEnterTier(session, 'enura') === session.isEnuraAdmin`.
 *
 * 'Hilfe' → /help is a public path (`PUBLIC_PREFIXES` in policy.ts), so it is
 * marked `always: true` rather than left to `canAccessRoute` — it is
 * reachable regardless of session, which `always` states explicitly.
 */
export const HOLDING_NAV: readonly NavItemConfig[] = [
  { label: '← Dashboard', href: '/platform', icon: 'arrow-left', tier: 'enura' },
  { label: 'Unternehmen', href: '/admin', icon: 'building', tier: 'holding' },
  { label: 'Hilfe', href: '/help', icon: 'help-circle', always: true },
]

// ---------------------------------------------------------------------------
// Company tier — "Company Admin" section of the dashboard-shell's
// "Admin Konsole" modal (super_user-only links). Icons here are raw SVG
// path `d` data, matching how dashboard-shell already renders this list —
// not the named-icon convention used by platform-shell / holding-shell.
// ---------------------------------------------------------------------------

export const COMPANY_ADMIN_NAV: readonly NavItemConfig[] = [
  {
    label: 'Leitfaden',
    href: '/settings/call-script',
    permission: 'module:admin:read',
    icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  },
  {
    label: 'Integrationen',
    href: '/settings/connectors',
    permission: 'module:admin:connectors',
    icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
  },
  {
    label: 'Benutzer',
    href: '/settings/users',
    permission: 'module:admin:users',
    icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  },
  {
    label: 'Branding',
    href: '/settings/branding',
    permission: 'module:admin:branding',
    icon: 'M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10c1.38 0 2.5-1.12 2.5-2.5 0-.61-.23-1.2-.64-1.67-.08-.1-.13-.21-.13-.33 0-.28.22-.5.5-.5H16c3.31 0 6-2.69 6-6 0-4.96-4.49-9-10-9z',
  },
  {
    label: 'Berichte',
    href: '/settings/reports',
    permission: 'module:admin:read',
    icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
]

/** Grouped export for callers that want all three configs by shell name. */
export const NAV_CONFIG = {
  platform: PLATFORM_NAV,
  holding: HOLDING_NAV,
  companyAdmin: COMPANY_ADMIN_NAV,
} as const

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

/**
 * Filters a nav config array down to the items the session may actually
 * reach, per the shared authz policy. Pure and server-safe (no I/O, no
 * `next/navigation`) — call it from any server component layout, after that
 * layout's own session-presence check (a non-null `session` is required;
 * every layout that renders a shell already has one by that point).
 */
export function filterNav(
  items: readonly NavItemConfig[],
  session: UserSession,
): NavItemConfig[] {
  return items.filter((item) => {
    if (item.always) return true
    if (item.permission) return hasModulePermission(session, item.permission)
    if (item.tier) return canEnterTier(session, item.tier)
    return canAccessRoute(session, item.href)
  })
}
