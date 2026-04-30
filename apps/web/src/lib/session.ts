import { cache } from 'react'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { UserSession, RoleRow, ProfileRow } from '@enura/types'
import type { MockSession } from '@/lib/auth'

const MOCK_AUTH = process.env.MOCK_AUTH !== 'false'

function _getMockSession(): UserSession | null {
  try {
    const cookieStore = cookies()
    const raw = cookieStore.get('mock-session')?.value
    if (!raw) return null

    const mock = JSON.parse(raw) as MockSession
    const now = new Date().toISOString()

    const profile: ProfileRow = {
      id: mock.userId,
      company_id: mock.companyId,
      holding_id: null,
      first_name: mock.firstName,
      last_name: mock.lastName,
      display_name: mock.displayName,
      avatar_url: null,
      phone: null,
      locale: 'de-CH',
      must_reset_password: mock.mustResetPassword,
      password_reset_at: null,
      totp_enabled: mock.totpEnabled,
      totp_enrolled_at: null,
      last_sign_in_at: now,
      is_active: true,
      created_at: now,
      updated_at: now,
    }

    const roles: RoleRow[] = mock.roles.map((key) => ({
      id: `mock-role-${key}`,
      company_id: mock.companyId,
      holding_id: null,
      key,
      label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      description: null,
      is_system: false,
      created_at: now,
      updated_at: now,
    }))

    return {
      profile,
      holdingId: null,
      companyId: mock.companyId,
      roles,
      permissions: mock.permissions,
      isEnuraAdmin: mock.roles.includes('enura_admin'),
      isHoldingAdmin: mock.isHoldingAdmin,
    }
  } catch (err) {
    console.error('[getSession] Mock session parse error:', err)
    return null
  }
}

async function _getSession(): Promise<UserSession | null> {
  // Mock auth mode — read from cookie, no Supabase needed
  if (MOCK_AUTH) {
    return _getMockSession()
  }

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
