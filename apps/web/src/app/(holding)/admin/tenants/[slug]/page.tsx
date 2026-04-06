import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { TenantRow, TenantBrandingRow, ProfileRow, ConnectorRow } from '@enura/types'
import { TenantDetailTabs } from './tenant-detail-tabs'

type TenantWithBranding = TenantRow & {
  tenant_brandings: TenantBrandingRow[]
}

type ProfileWithRoles = ProfileRow & {
  profile_roles: {
    role_id: string
    roles: { key: string; label: string } | null
  }[]
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusBadge(status: string): { label: string; classes: string } {
  switch (status) {
    case 'active':
      return { label: 'Aktiv', classes: 'bg-green-100 text-green-700' }
    case 'suspended':
      return { label: 'Gesperrt', classes: 'bg-red-100 text-red-700' }
    case 'archived':
      return { label: 'Archiviert', classes: 'bg-gray-100 text-gray-500' }
    default:
      return { label: status, classes: 'bg-gray-100 text-gray-500' }
  }
}

function connectorStatusBadge(status: string): { label: string; classes: string } {
  switch (status) {
    case 'active':
      return { label: 'Aktiv', classes: 'bg-green-100 text-green-700' }
    case 'paused':
      return { label: 'Pausiert', classes: 'bg-yellow-100 text-yellow-700' }
    case 'error':
      return { label: 'Fehler', classes: 'bg-red-100 text-red-700' }
    case 'disconnected':
      return { label: 'Getrennt', classes: 'bg-gray-100 text-gray-500' }
    default:
      return { label: status, classes: 'bg-gray-100 text-gray-500' }
  }
}

export default async function TenantDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = createSupabaseServerClient()

  // Fetch tenant with branding
  const { data: tenant } = await supabase
    .from('tenants')
    .select('*, tenant_brandings(*)')
    .eq('slug', slug)
    .single()

  if (!tenant) {
    notFound()
  }

  const typedTenant = tenant as unknown as TenantWithBranding
  const branding = typedTenant.tenant_brandings?.[0] ?? null

  // Fetch users in this tenant
  const { data: profiles } = await supabase
    .from('profiles')
    .select(`
      *,
      profile_roles (
        role_id,
        roles ( key, label )
      )
    `)
    .eq('tenant_id', typedTenant.id)
    .order('created_at', { ascending: false })

  const users = (profiles ?? []) as unknown as ProfileWithRoles[]

  // Fetch connectors for this tenant
  const { data: connectors } = await supabase
    .from('connectors')
    .select('*')
    .eq('tenant_id', typedTenant.id)
    .order('created_at', { ascending: false })

  const connectorList = (connectors ?? []) as ConnectorRow[]

  // Find the super user
  const superUser = users.find((u) =>
    u.profile_roles?.some((pr) => pr.roles?.key === 'super_user'),
  )

  const badge = statusBadge(typedTenant.status)

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Zurück zur Übersicht
        </Link>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{typedTenant.name}</h1>
          <p className="text-gray-500 mt-1 font-mono text-sm">{typedTenant.slug}.platform.com</p>
        </div>
        <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${badge.classes}`}>
          {badge.label}
        </span>
      </div>

      <TenantDetailTabs
        tenant={typedTenant}
        branding={branding}
        users={users.map((u) => ({
          id: u.id,
          firstName: u.first_name,
          lastName: u.last_name,
          displayName: u.display_name,
          isActive: u.is_active,
          mustResetPassword: u.must_reset_password,
          totpEnabled: u.totp_enabled,
          createdAt: u.created_at,
          lastSignInAt: u.last_sign_in_at,
          roles: u.profile_roles
            ?.map((pr) => pr.roles?.label)
            .filter((r): r is string => Boolean(r)) ?? [],
        }))}
        superUser={
          superUser
            ? {
                firstName: superUser.first_name,
                lastName: superUser.last_name,
                displayName: superUser.display_name,
              }
            : null
        }
        connectors={connectorList.map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          status: c.status,
          lastSyncedAt: c.last_synced_at,
          lastError: c.last_error,
        }))}
        formatDate={formatDate}
        statusBadge={statusBadge}
        connectorStatusBadge={connectorStatusBadge}
      />
    </div>
  )
}
