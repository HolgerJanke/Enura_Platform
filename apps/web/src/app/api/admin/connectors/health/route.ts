import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'

interface ConnectorHealth {
  type: string
  status: string
  lastSyncedAt: string | null
  lastError: string | null
}

interface TenantConnectorHealth {
  companyId: string
  companySlug: string
  companyName: string
  connectors: ConnectorHealth[]
}

export async function GET() {
  const session = await getSession()
  if (!session?.isHoldingAdmin) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 })
  }

  const supabase = createSupabaseServerClient()

  // Alle aktiven Mandanten laden
  const { data: tenants, error: tenantsError } = await supabase
    .from('companies')
    .select('id, slug, name')
    .eq('status', 'active')

  if (tenantsError) {
    return NextResponse.json(
      { error: 'Mandanten konnten nicht geladen werden' },
      { status: 500 },
    )
  }

  // Alle Konnektoren laden
  const { data: connectors, error: connectorsError } = await supabase
    .from('connectors')
    .select('id, company_id, type, status, last_synced_at, last_error')

  if (connectorsError) {
    return NextResponse.json(
      { error: 'Konnektoren konnten nicht geladen werden' },
      { status: 500 },
    )
  }

  const result: TenantConnectorHealth[] = (
    (tenants ?? []) as Record<string, unknown>[]
  ).map((tenant) => {
    const companyId = tenant['id'] as string
    const tenantConnectors = (
      (connectors ?? []) as Record<string, unknown>[]
    )
      .filter((c) => c['company_id'] === companyId)
      .map((c): ConnectorHealth => ({
        type: c['type'] as string,
        status: c['status'] as string,
        lastSyncedAt: (c['last_synced_at'] as string | null) ?? null,
        lastError: (c['last_error'] as string | null) ?? null,
      }))

    return {
      companyId,
      companySlug: tenant['slug'] as string,
      companyName: tenant['name'] as string,
      connectors: tenantConnectors,
    }
  })

  return NextResponse.json({ data: result })
}
