import type { UserSession } from '@enura/types'

/** Company modules, in the order a company user should land on them. */
const MODULE_PRIORITY = [
  { permission: 'module:setter:read', path: '/setter' },
  { permission: 'module:berater:read', path: '/berater' },
  { permission: 'module:leads:read', path: '/leads' },
  { permission: 'module:innendienst:read', path: '/innendienst' },
  { permission: 'module:bau:read', path: '/projects' },
  { permission: 'module:finance:read', path: '/finance' },
] as const

/**
 * Where a signed-in user belongs, following the Enura Group → Holding → Company
 * tiers. Each tier has its own root, and an admin without a company has nothing
 * to render on the company dashboard — sending them there produced a blank page.
 *
 *   Enura admin   → /platform
 *   Holding admin → /admin
 *   Company user  → first permitted module, else /dashboard
 */
export function resolveLandingPath(session: UserSession): string {
  if (session.isEnuraAdmin) return '/platform'
  if (session.isHoldingAdmin) return '/admin'

  const firstModule = MODULE_PRIORITY.find((mod) =>
    session.permissions.includes(mod.permission),
  )
  return firstModule?.path ?? '/dashboard'
}
