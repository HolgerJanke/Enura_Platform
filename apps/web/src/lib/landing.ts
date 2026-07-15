import type { UserSession } from '@enura/types'

const MODULE_PRIORITY = [
  { permission: 'module:setter:read', path: '/setter' },
  { permission: 'module:berater:read', path: '/berater' },
  { permission: 'module:leads:read', path: '/leads' },
  { permission: 'module:innendienst:read', path: '/innendienst' },
  { permission: 'module:bau:read', path: '/projects' },
  { permission: 'module:finance:read', path: '/finance' },
]

export function resolveLandingPath(session: UserSession): string {
  if (session.isEnuraAdmin) return '/platform'      // Enura Group overview (all holdings)
  if (session.isHoldingAdmin) return '/admin'       // Holding overview (all companies)
  const first = MODULE_PRIORITY.find(m => session.permissions.includes(m.permission))
  return first?.path ?? '/dashboard'
}
