import Link from 'next/link'
import { requirePermission } from '@/lib/permissions'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { UserListClient } from './user-list-client'
import { Require2faToggle } from './require-2fa-toggle'

export default async function UsersSettingsPage() {
  await requirePermission('module:admin:users')

  const session = await getSession()
  if (!session) return null

  const supabase = createSupabaseServerClient()
  const companyId = session.companyId ?? ''

  // Fetch users in this tenant
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })

  // Fetch roles for the tenant
  const { data: roles } = await supabase
    .from('roles')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_system', true)
    .order('key')

  // Fetch profile_roles for all profiles
  const profileIds = (profiles ?? []).map((p: Record<string, unknown>) => p['id'] as string)
  const { data: profileRoles } = await supabase
    .from('profile_roles')
    .select('profile_id, role_id, roles(id, key, label)')
    .in('profile_id', profileIds.length > 0 ? profileIds : ['none'])

  // Fetch 2FA setting
  const canAdmin = session.permissions.includes('module:admin:write') || session.isHoldingAdmin
  let require2fa = false
  if (canAdmin && companyId) {
    const { data: settings } = await supabase
      .from('company_settings')
      .select('require_2fa')
      .eq('company_id', companyId)
      .single()
    require2fa = (settings as Record<string, unknown> | null)?.require_2fa === true
  }

  return (
    <div className="p-6">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        &larr; Zurueck zum Prozesshaus
      </Link>
      {canAdmin && (
        <Require2faToggle initialValue={require2fa} />
      )}
      <UserListClient
        profiles={profiles ?? []}
        roles={roles ?? []}
        profileRoles={
          (profileRoles ?? []) as unknown as Array<{
            profile_id: string
            role_id: string
            roles: { id: string; key: string; label: string } | null
          }>
        }
        currentUserId={session.profile.id}
      />
    </div>
  )
}
