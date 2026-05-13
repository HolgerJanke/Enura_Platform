export const dynamic = 'force-dynamic'

import { requirePermission } from '@/lib/permissions'
import { getSession } from '@/lib/session'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { ConnectorListClient } from './connector-list-client'

const CONNECTOR_TYPES = [
  { type: 'reonic', label: 'Reonic', description: 'Leads, Projekte, Angebote', icon: 'link' },
  { type: '3cx', label: '3CX Cloud', description: 'Anrufe, Aufnahmen, Nebenstellen', icon: 'phone' },
  { type: 'bexio', label: 'Bexio', description: 'Rechnungen, Zahlungen', icon: 'banknotes' },
  { type: 'google_calendar', label: 'Google Calendar', description: 'Termine aller Mitarbeiter', icon: 'calendar' },
  { type: 'leadnotes', label: 'LeadNotes', description: 'Eingehende Leads', icon: 'inbox' },
  { type: 'gmail', label: 'Gmail', description: 'Posteingang und Versand', icon: 'mail' },
  { type: 'whatsapp', label: 'WhatsApp', description: 'Business Messaging', icon: 'link' },
] as const

export type ConnectorTypeInfo = (typeof CONNECTOR_TYPES)[number]

export default async function ConnectorsPage() {
  await requirePermission('module:admin:read')
  const session = await getSession()
  if (!session?.companyId) return null

  const supabase = createSupabaseServiceClient()

  // Fetch configured connectors for this tenant
  const { data: connectors } = await supabase
    .from('connectors')
    .select('*')
    .eq('company_id', session.companyId)

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
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-brand-text-primary mb-2">Integrationen</h1>
      <p className="text-sm text-brand-text-secondary mb-6">
        Verbinden Sie externe Systeme, um Daten automatisch zu synchronisieren.
      </p>
      <ConnectorListClient
        connectorTypes={CONNECTOR_TYPES as unknown as ReadonlyArray<ConnectorTypeInfo>}
        configuredConnectors={(connectors ?? []) as unknown as Array<Record<string, unknown>>}
        syncLogs={(syncLogs ?? []) as unknown as Array<Record<string, unknown>>}
        companyId={session.companyId}
      />
    </div>
  )
}
