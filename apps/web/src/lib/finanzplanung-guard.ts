import { cache } from 'react'
import { getSession } from './session'
import { createSupabaseServerClient } from './supabase/server'

/**
 * Cached per-request feature-flag read, keyed on the primitive company id so
 * repeated guard calls within one render reuse a single query.
 */
const isFinanzplanungEnabled = cache(async (companyId: string): Promise<boolean> => {
  const supabase = createSupabaseServerClient()
  const { data } = await supabase
    .from('company_feature_flags')
    .select('finanzplanung_enabled')
    .eq('company_id', companyId)
    .single()

  return data?.finanzplanung_enabled === true
})

/**
 * Check if the current company has the Finanzplanung module enabled.
 * Returns true only when the company flag is set.
 */
export async function checkFinanzplanungActive(
  session: { companyId: string | null; holdingId: string | null } | null,
): Promise<boolean> {
  if (!session?.companyId) return false
  return isFinanzplanungEnabled(session.companyId)
}

/**
 * Require Finanzplanung module to be active for the current company.
 * Returns false if not active (caller should render fallback UI).
 */
export async function requireFinanzplanung(): Promise<boolean> {
  const session = await getSession()
  if (!session) return false

  // Holding/Enura admins bypass all checks
  if (session.isHoldingAdmin || session.isEnuraAdmin) return true

  const isActive = await checkFinanzplanungActive(session)
  if (!isActive) return false

  if (!session.permissions.includes('module:finanzplanung:read')) return false

  return true
}

/**
 * Role-specific permission checks. All require base Finanzplanung access.
 */
export async function hasFinanzplanungPermission(
  permission: string,
): Promise<boolean> {
  const session = await getSession()
  if (!session) return false

  const isActive = await checkFinanzplanungActive(session)
  if (!isActive) return false

  if (session.isHoldingAdmin || session.isEnuraAdmin) return true
  return session.permissions.includes(permission)
}
