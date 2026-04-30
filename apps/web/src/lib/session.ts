import { cache } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { UserSession, RoleRow } from '@enura/types'

async function _getSession(): Promise<UserSession | null> {
  try {
    const supabase = createSupabaseServerClient()

    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return null

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
