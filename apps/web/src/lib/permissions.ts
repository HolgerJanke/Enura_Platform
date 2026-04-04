import { getSession } from './session'

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
