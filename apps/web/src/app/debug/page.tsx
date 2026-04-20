export const dynamic = 'force-dynamic'

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
  let tenantQueryStatus = 'unknown'
  let directFetchStatus = 'unknown'
  let envStatus = 'unknown'

  // Test direct REST fetch (same as middleware does)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  envStatus = `URL=${supabaseUrl ? 'set' : 'MISSING'}, KEY=${supabaseKey ? supabaseKey.slice(0, 15) + '...' : 'MISSING'}`

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/tenants?slug=eq.alpen-energie&status=eq.active&select=id,slug,name,status&limit=1`,
      {
        headers: {
          apikey: supabaseKey ?? '',
          Authorization: `Bearer ${supabaseKey ?? ''}`,
        },
        cache: 'no-store',
      },
    )
    const body = await res.text()
    directFetchStatus = `status=${res.status}, body=${body.slice(0, 200)}`
  } catch (err) {
    directFetchStatus = `error: ${err instanceof Error ? err.message : String(err)}`
  }

  try {
    const supabase = createSupabaseServerClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    authStatus = user ? `authenticated: ${user.id}` : `no user: ${error?.message ?? 'null'}`

    // Test tenant query (same as middleware does)
    const { data: tenantData, error: tenantError } = await supabase
      .from('tenants')
      .select('id, slug, name, status')
      .eq('slug', 'alpen-energie')
      .eq('status', 'active')
      .single()
    tenantQueryStatus = tenantData
      ? `found: ${JSON.stringify(tenantData)}`
      : `error: ${tenantError?.message ?? 'null'} (code: ${tenantError?.code ?? 'none'})`

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
        envStatus,
        directFetchStatus,
        authStatus,
        tenantQueryStatus,
        profileStatus,
        rolesStatus,
      }, null, 2)}</pre>
    </div>
  )
}
