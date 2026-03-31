import { redirect } from 'next/navigation'
import { getSession } from './session'

/**
 * Require a specific permission. Redirects to /dashboard if not authorized.
 * Use in Server Components at the top of the component function.
 */
export async function requirePermission(permissionKey: string): Promise<void> {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.isHoldingAdmin) return
  if (!session.permissions.includes(permissionKey)) redirect('/dashboard')
}

/**
 * Check a permission without redirecting. Returns boolean.
 */
export async function checkPermission(permissionKey: string): Promise<boolean> {
  const session = await getSession()
  if (!session) return false
  if (session.isHoldingAdmin) return true
  return session.permissions.includes(permissionKey)
}

/**
 * Require the user to be a holding admin. Redirects to /login if not.
 */
export async function requireHoldingAdmin(): Promise<void> {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!session.isHoldingAdmin) redirect('/login')
}

/**
 * Require authentication. Redirects to /login if no session.
 */
export async function requireAuth(): Promise<void> {
  const session = await getSession()
  if (!session) redirect('/login')
}

/**
 * Require the user to be an Enura platform admin. Redirects to /login if not.
 */
export async function requireEnuraAdmin(): Promise<void> {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!session.isEnuraAdmin) redirect('/login')
}
