import { cache } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import type { UserSession, RoleRow } from '@enura/types'

async function _getSession(): Promise<UserSession | null> {
  const supabase = createSupabaseServerClient()
  const service = createSupabaseServiceClient()

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) return null

  // Fetch roles with permissions (service client bypasses RLS for system lookups)
  const { data: profileRoles } = await service
    .from('profile_roles')
    .select(`
      role_id,
      roles (
        id, key, label, description, is_system, created_at, updated_at
      )
    `)
    .eq('profile_id', user.id)

  const roles: RoleRow[] = (profileRoles ?? [])
    .map((pr) => (pr as Record<string, unknown>).roles as RoleRow | null)
    .filter((r): r is RoleRow => r !== null)

  // Fetch permissions for these roles
  const roleIds = roles.map((r) => r.id)
  let permissions: string[] = []

  if (roleIds.length > 0) {
    const { data: rolePerms } = await service
      .from('role_permissions')
      .select(`
        permission_id,
        permissions ( key )
      `)
      .in('role_id', roleIds)

    permissions = (rolePerms ?? [])
      .map((rp) => ((rp as Record<string, unknown>).permissions as { key: string } | null)?.key)
      .filter((k): k is string => Boolean(k))
  }

  // Check holding admin status
  const { data: holdingAdmin } = await service
    .from('holding_admins')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle()

  const isHoldingAdmin = Boolean(holdingAdmin)

  return {
    profile,
    tenantId: (profile as Record<string, unknown>).company_id as string ?? (profile as Record<string, unknown>).tenant_id as string ?? null,
    roles,
    permissions: [...new Set(permissions)],
    isHoldingAdmin,
  }
}

/** Cached per-request session resolver. Safe to call multiple times in a render cycle. */
export const getSession = cache(_getSession)
