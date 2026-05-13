import { getSession } from './session'
import { createSupabaseServiceClient } from './supabase/service'

/**
 * Check if the current company has the Finanzplanung module enabled.
 * Uses service client to bypass RLS (works with mock auth).
 */
export async function checkFinanzplanungActive(
  session: { companyId: string | null; holdingId: string | null } | null,
): Promise<boolean> {
  if (!session?.companyId) return false

  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('company_feature_flags')
    .select('finanzplanung_enabled')
    .eq('company_id', session.companyId)
    .single()

  return data?.finanzplanung_enabled === true
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
 * Holding/Enura admins bypass all checks (consistent with requireFinanzplanung).
 */
export async function hasFinanzplanungPermission(
  permission: string,
): Promise<boolean> {
  const session = await getSession()
  if (!session) return false

  // Holding/Enura admins bypass all checks
  if (session.isHoldingAdmin || session.isEnuraAdmin) return true

  const isActive = await checkFinanzplanungActive(session)
  if (!isActive) return false

  return session.permissions.includes(permission)
}
