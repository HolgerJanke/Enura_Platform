import { getSession } from './session'
import type { UserSession } from '@enura/types'

export type HoldingSession = {
  session: UserSession
  /**
   * The holding every query must be scoped to, or null for Enura admins who
   * intentionally span all holdings.
   */
  holdingId: string | null
  isEnuraAdmin: boolean
}

/**
 * Require holding-admin access AND return the scope that queries must be
 * filtered by.
 *
 * Prefer this over `requireHoldingAdmin()`: the boolean form carries no holding
 * id, so callers that only check the role bit end up reading and mutating across
 * every holding. Enura admins deliberately bypass the filter (holdingId = null).
 */
export async function requireHoldingSession(): Promise<HoldingSession | null> {
  const session = await getSession()
  if (!session) return null
  if (!session.isHoldingAdmin && !session.isEnuraAdmin) return null

  return {
    session,
    holdingId: session.isEnuraAdmin ? null : session.holdingId,
    isEnuraAdmin: session.isEnuraAdmin,
  }
}

/**
 * Require a specific permission. Returns false if not authorized.
 * Use in Server Components: if (!await requirePermission('key')) return <Fallback/>
 */
export async function requirePermission(permissionKey: string): Promise<boolean> {
  const session = await getSession()
  if (!session) return false
  if (session.isHoldingAdmin || session.isEnuraAdmin) return true
  return session.permissions.includes(permissionKey)
}

/**
 * Check a permission without redirecting. Returns boolean.
 */
export async function checkPermission(permissionKey: string): Promise<boolean> {
  const session = await getSession()
  if (!session) return false
  if (session.isHoldingAdmin || session.isEnuraAdmin) return true
  return session.permissions.includes(permissionKey)
}

/**
 * Require the user to be a holding admin. Returns false if not.
 */
export async function requireHoldingAdmin(): Promise<boolean> {
  const session = await getSession()
  if (!session) return false
  return session.isHoldingAdmin || session.isEnuraAdmin
}

/**
 * Require authentication. Returns false if no session.
 */
export async function requireAuth(): Promise<boolean> {
  const session = await getSession()
  return session !== null
}

/**
 * Require the user to be an Enura platform admin. Returns false if not.
 */
export async function requireEnuraAdmin(): Promise<boolean> {
  const session = await getSession()
  if (!session) return false
  return session.isEnuraAdmin
}
