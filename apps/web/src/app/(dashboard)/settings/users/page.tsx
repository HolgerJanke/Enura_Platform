import { requirePermission } from '@/lib/permissions'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { UserListClient } from './user-list-client'

export default async function UsersSettingsPage() {
  await requirePermission('module:admin:users')

  const session = await getSession()
  if (!session) return null

  const supabase = createSupabaseServerClient()
  const tenantId = session.tenantId ?? ''

  // Fetch users in this tenant
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })

  // Fetch roles for the tenant
  const { data: roles } = await supabase
    .from('roles')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_system', true)
    .order('key')

  // Fetch profile_roles for all profiles
  const profileIds = (profiles ?? []).map((p: Record<string, unknown>) => p['id'] as string)
  const { data: profileRoles } = await supabase
    .from('profile_roles')
    .select('profile_id, role_id, roles(id, key, label)')
    .in('profile_id', profileIds.length > 0 ? profileIds : ['none'])

  return (
    <div className="p-6">
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
