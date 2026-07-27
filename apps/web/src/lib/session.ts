import { cache } from 'react'
import { headers } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { UserSession, RoleRow } from '@enura/types'

/**
 * Resolve the verified user id.
 *
 * The middleware has already validated the JWT and forwards the verified id on
 * `x-auth-user-id` (a header it strips from every inbound request, so a client
 * cannot forge it). When present we trust it and skip a second network
 * `auth.getUser()` round trip. Profile/roles queries still run under the user's
 * own JWT via cookies, so RLS remains the backstop even if the header were wrong.
 */
async function resolveUserId(
  supabase: ReturnType<typeof createSupabaseServerClient>,
): Promise<string | null> {
  const forwarded = headers().get('x-auth-user-id')
  if (forwarded) return forwarded

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user.id
}

async function _getSession(): Promise<UserSession | null> {
  try {
    const supabase = createSupabaseServerClient()

    const userId = await resolveUserId(supabase)
    if (!userId) return null
    const user = { id: userId }

    // Run ALL queries in parallel instead of sequentially
    // This cuts ~1200ms down to ~400ms (1 round-trip instead of 5)
    const [profileResult, rolesResult, holdingAdminResult, enuraAdminResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('profile_roles').select(`
        role_id,
        roles ( id, company_id, holding_id, key, label, description, is_system, created_at, updated_at )
      `).eq('profile_id', user.id),
      supabase.from('holding_admins').select('id').eq('profile_id', user.id).maybeSingle(),
      supabase.from('enura_admins').select('id').eq('profile_id', user.id).maybeSingle(),
    ])

    const profile = profileResult.data
    if (!profile) return null

    const roles: RoleRow[] = (rolesResult.data ?? [])
      .map((pr) => (pr as Record<string, unknown>).roles as RoleRow | null)
      .filter((r): r is RoleRow => r !== null)

    // Fetch permissions in parallel if roles exist
    let permissions: string[] = []
    const roleIds = roles.map((r) => r.id)

    if (roleIds.length > 0) {
      const { data: rolePerms } = await supabase
        .from('role_permissions')
        .select('permission_id, permissions ( key )')
        .in('role_id', roleIds)

      permissions = (rolePerms ?? [])
        .map((rp) => ((rp as Record<string, unknown>).permissions as { key: string } | null)?.key)
        .filter((k): k is string => Boolean(k))
    }

    return {
      profile,
      holdingId: profile.holding_id,
      companyId: profile.company_id,
      roles,
      permissions: [...new Set(permissions)],
      isEnuraAdmin: Boolean(enuraAdminResult.data),
      isHoldingAdmin: Boolean(holdingAdminResult.data),
    }
  } catch (err) {
    console.error('[getSession] Error:', err instanceof Error ? err.message : err)
    return null
  }
}

/** Cached per-request session resolver. Safe to call multiple times in a render cycle. */
export const getSession = cache(_getSession)

/** Paths a gated user is still allowed to reach, so the gates can be satisfied. */
const AUTH_GATE_EXEMPT_PATHS = ['/reset-password', '/enrol-2fa', '/verify-2fa', '/login']

/**
 * CLAUDE.md §4.2 gates (b) and (c): before any authenticated content renders, a
 * user must have reset their temporary password and enrolled 2FA.
 *
 * Returns the path the user must be sent to, or null when both gates pass.
 * Callers must return a redirect *only* — rendering children alongside it would
 * still ship the gated content to the client.
 */
export function authGateRedirect(
  session: UserSession,
  pathname?: string,
): string | null {
  if (pathname && AUTH_GATE_EXEMPT_PATHS.some((p) => pathname.startsWith(p))) {
    return null
  }
  if (session.profile.must_reset_password) return '/reset-password'
  if (!session.profile.totp_enabled) return '/enrol-2fa'
  return null
}
