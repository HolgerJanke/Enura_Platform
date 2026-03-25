import { headers } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function DebugPage() {
  const headerStore = headers()
  const tenantId = headerStore.get('x-tenant-id') ?? 'none'
  const tenantSlug = headerStore.get('x-tenant-slug') ?? 'none'
  const userId = headerStore.get('x-user-id') ?? 'none'

  let authStatus = 'unknown'
  let profileStatus = 'unknown'
  let rolesStatus = 'unknown'

  try {
    const supabase = createSupabaseServerClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    authStatus = user ? `authenticated: ${user.id}` : `no user: ${error?.message ?? 'null'}`

    if (user) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, tenant_id, first_name')
        .eq('id', user.id)
        .single()
      profileStatus = profile
        ? `found: ${(profile as Record<string, unknown>)['first_name']}`
        : `not found: ${profileError?.message ?? 'null'}`

      const { data: roles, error: rolesError } = await supabase
        .from('profile_roles')
        .select('role_id')
        .eq('profile_id', user.id)
      rolesStatus = roles
        ? `${roles.length} roles`
        : `error: ${rolesError?.message ?? 'null'}`
    }
  } catch (err) {
    authStatus = `error: ${err instanceof Error ? err.message : String(err)}`
  }

  return (
    <div style={{ padding: 40, fontFamily: 'monospace' }}>
      <h1>Debug</h1>
      <pre>{JSON.stringify({
        tenantId,
        tenantSlug,
        userId,
        authStatus,
        profileStatus,
        rolesStatus,
      }, null, 2)}</pre>
    </div>
  )
}
