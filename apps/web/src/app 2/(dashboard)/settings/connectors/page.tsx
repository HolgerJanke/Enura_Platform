import { requirePermission } from '@/lib/permissions'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ConnectorListClient } from './connector-list-client'

const CONNECTOR_TYPES = [
  { type: 'reonic', label: 'Reonic CRM', description: 'Leads, Angebote, Team-Mitglieder', icon: 'link' },
  { type: '3cx', label: '3CX Cloud', description: 'Anrufe, Aufnahmen', icon: 'phone' },
  { type: 'bexio', label: 'Bexio', description: 'Rechnungen, Zahlungen', icon: 'banknotes' },
  { type: 'google_calendar', label: 'Google Calendar', description: 'Termine aller Mitarbeiter', icon: 'calendar' },
  { type: 'leadnotes', label: 'Leadnotes', description: 'Eingehende Leads', icon: 'inbox' },
] as const

export type ConnectorTypeInfo = (typeof CONNECTOR_TYPES)[number]

export default async function ConnectorsPage() {
  await requirePermission('module:admin:read')
  const session = await getSession()
  if (!session?.tenantId) return null

  const supabase = createSupabaseServerClient()

  // Fetch configured connectors for this tenant
  const { data: connectors } = await supabase
    .from('connectors')
    .select('*')
    .eq('tenant_id', session.tenantId)

  // Fetch latest sync log for each connector
  const connectorIds = (connectors ?? []).map((c: Record<string, unknown>) => c['id'] as string)
  const { data: syncLogs } = connectorIds.length > 0
    ? await supabase
        .from('connector_sync_log')
        .select('*')
        .in('connector_id', connectorIds)
        .order('started_at', { ascending: false })
        .limit(connectorIds.length)
    : { data: [] }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-brand-text-primary mb-2">Integrationen</h1>
      <p className="text-brand-text-secondary mb-6">
        Verbinden Sie externe Systeme, um Daten automatisch zu synchronisieren.
      </p>
      <ConnectorListClient
        connectorTypes={CONNECTOR_TYPES as unknown as ReadonlyArray<ConnectorTypeInfo>}
        configuredConnectors={(connectors ?? []) as unknown as Array<Record<string, unknown>>}
        syncLogs={(syncLogs ?? []) as unknown as Array<Record<string, unknown>>}
        tenantId={session.tenantId}
      />
    </div>
  )
}
